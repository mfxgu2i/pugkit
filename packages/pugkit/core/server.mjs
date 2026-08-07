import http from 'node:http'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import sirv from 'sirv'
import { logger } from '../utils/logger.mjs'
import { buildPageHtml } from '../tasks/pug.mjs'

const SSE_PATH = '/__pugkit_sse'

/**
 * idiomorph 本体（DOM 差分適用ライブラリ）をクライアントスクリプトに同梱するため読み込む。
 * dev サーバー起動時にだけ読むよう遅延化している（build では読まれない）。
 * 読めない場合は DOM 差分更新を諦めてフルリロードにフォールバックする。
 */
let idiomorphSource
function loadIdiomorphSource() {
  if (idiomorphSource === undefined) {
    try {
      const require = createRequire(import.meta.url)
      idiomorphSource = readFileSync(require.resolve('idiomorph/dist/idiomorph.min.js'), 'utf8')
    } catch {
      idiomorphSource = null
    }
  }
  return idiomorphSource
}

/**
 * body の差分適用で反映できない部分（<html> の属性・head・<script>）の指紋。
 * 前回そのページに返した HTML と一致していれば差分適用してよい。
 * 両方ともサーバー生成の HTML から同じ方法で抽出するため、ブラウザのパース差に影響されない。
 */
export function computeMorphSignature(html) {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const scripts = html.match(/<script\b[\s\S]*?<\/script>/gi)?.join('') ?? ''
  return createHash('md5').update(`${htmlTag}\u0000${head}\u0000${scripts}`).digest('hex')
}

/**
 * HTMLに挿入するライブリロードクライアントスクリプト。
 *
 * - domDiff: Pug 変更時に location.reload() ではなく、新しい HTML を取得して
 *   表示中の DOM へ差分適用する。スクロール位置・フォーム入力・スライダーの
 *   状態や遅延読み込み済み画像が保持され、リロード特有のちらつきが起きない。
 *   <script> の変更・取得失敗・差分適用エラー時はフルリロードに退避する。
 * - scroll: エラーページでは無効化する。保存済みの位置を消費せず温存し、
 *   エラーページ自身の位置（≒先頭）も保存しないことで、修正後のリロードで
 *   エラー前のスクロール位置に戻れるようにする。
 */
function createLiveReloadScript({ scroll = true, domDiff = true } = {}) {
  const restoreScroll = scroll
    ? `try {
    var saved = sessionStorage.getItem(scrollKey);
    if (saved !== null) {
      sessionStorage.removeItem(scrollKey);
      // ブラウザ標準の復元（直前ドキュメントの位置＝エラーページ等で 0 になり得る）が
      // load 後にこちらの復元を上書きするため、保存値があるときは手動復元に切り替える
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      var pos = saved.split(',');
      var sx = parseInt(pos[0], 10) || 0;
      var sy = parseInt(pos[1], 10) || 0;
      window.scrollTo(sx, sy);
      window.addEventListener('load', function() {
        window.scrollTo(sx, sy);
        setTimeout(function() {
          window.scrollTo(sx, sy);
          if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
        }, 50);
      });
    }
  } catch (e) {}`
    : ''
  const saveScrollBody = scroll
    ? `try {
      sessionStorage.setItem(scrollKey, window.scrollX + ',' + window.scrollY);
    } catch (e) {}`
    : ''

  const idiomorphSource = domDiff ? loadIdiomorphSource() : null
  const useMorph = idiomorphSource !== null

  return `<script>
(function() {
  // リロード前に保存したスクロール位置を復元する（編集のたびに先頭へ戻るのを防ぐ）
  var scrollKey = '__pugkit_scroll:' + location.pathname;
  ${restoreScroll}
  function saveScroll() {
    ${saveScrollBody}
  }
  function fullReload() {
    saveScroll();
    location.reload();
  }
${useMorph ? idiomorphSource : ''}
  // このスクリプトが動く時点（body 末尾）の DOM ＝ サーバー生成そのまま。
  // ここに無い要素は実行時に差し込まれたもの（解析タグ・同意バナー・チャット等）
  // として扱い、差分適用で消さないようにする
  var serverNodes = typeof WeakSet === 'function' ? new WeakSet() : null;
  function markServerNodes(root) {
    if (!serverNodes || root.nodeType !== 1) return;
    serverNodes.add(root);
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) serverNodes.add(all[i]);
  }
  function applyMorph() {
    return fetch(location.href, { cache: 'no-store' }).then(function(res) {
      if (!res.ok) throw new Error('status ' + res.status);
      // head・<html> 属性・<script> が変わっていないかはサーバーが判定する。
      // morph では <script> が再実行されず head の変更も反映できないため
      // 変わっていればフルリロードに退避する
      if (res.headers.get('x-pugkit-morphable') !== '1') throw new Error('needs full reload');
      return res.text();
    }).then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.body) throw new Error('parse failed');
      // 差分適用は body に限定する。head は解析タグが実行時に差し込んだ要素を
      // 巻き込むため触らない（head の変更は上のヘッダー判定でフルリロードになる）
      Idiomorph.morph(document.body, doc.body, {
        ignoreActiveValue: true,
        callbacks: {
          beforeNodeMorphed: function(oldNode) {
            // <noscript> の中身はライブ DOM ではテキスト、DOMParser では要素として
            // 解釈される。差分を取ると中の iframe/img が実体化して実際に読み込まれる
            if (oldNode.nodeType === 1 && oldNode.tagName === 'NOSCRIPT') return false;
          },
          beforeNodeRemoved: function(node) {
            // 実行時に差し込まれた要素は残す。サーバー生成の要素は Pug から
            // 消されたということなので通常どおり削除する
            if (serverNodes && node.nodeType === 1 && !serverNodes.has(node)) return false;
          },
          afterNodeAdded: function(node) {
            markServerNodes(node);
          }
        }
      });
      window.dispatchEvent(new CustomEvent('pugkit:morphed'));
    });
  }
  if (typeof Idiomorph !== 'undefined') markServerNodes(document.body);
  var es = new EventSource('${SSE_PATH}');
  es.addEventListener('reload', function(e) {
    var kind = (e && e.data) || 'full';
    if (kind !== 'html' || typeof Idiomorph === 'undefined') {
      fullReload();
      return;
    }
    applyMorph().catch(function(err) {
      if (window.console && console.debug) console.debug('[pugkit] full reload:', err && err.message);
      fullReload();
    });
  });
  es.addEventListener('css-update', function() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
      var url = new URL(link.href);
      if (url.origin !== location.origin) return;
      url.searchParams.set('t', Date.now());
      link.href = url.toString();
    });
  });
  es.onerror = function() {
    es.close();
    setTimeout(function() {
      saveScroll();
      location.reload();
    }, 1000);
  };
  window.addEventListener('beforeunload', function() {
    es.close();
  });
})();
</script>`
}

/**
 * リクエストURLを src 内の Pug ソースに解決する。
 * 対象外（非HTML・subdir不一致・「_」始まりセグメント・src外・ファイル無し）は null。
 *
 * 候補順は sirv の解決順（フラットファイル優先。末尾スラッシュは除去して同順）に合わせる:
 *   /foo.html  -> src/foo.pug
 *   /foo       -> src/foo.pug -> src/foo/index.pug
 *   /foo/      -> src/foo.pug -> src/foo/index.pug
 *   /          -> src/index.pug
 */
export function resolvePugSource(urlPath, paths, subdir = '') {
  let p = urlPath

  if (subdir) {
    // 境界チェック: /sub と /sub/... のみ対象（/subfoo は不一致）
    if (p === subdir) p = '/'
    else if (p.startsWith(subdir + '/')) p = p.slice(subdir.length)
    else return null
  }

  if (!p.startsWith('/')) return null

  // sirv 互換: 末尾スラッシュは除去して解決（/foo/ と /foo は同じ候補順）
  if (p !== '/' && p.endsWith('/')) p = p.replace(/\/+$/, '')

  const candidates = []
  if (p === '/') {
    candidates.push('/index.pug')
  } else if (/\.html$/i.test(p)) {
    candidates.push(p.replace(/\.html$/i, '.pug'))
  } else if (!path.posix.extname(p)) {
    candidates.push(p + '.pug', p + '/index.pug')
  } else {
    return null
  }

  for (const rel of candidates) {
    const abs = path.resolve(paths.src, '.' + rel)

    // src 封じ込め（パストラバーサル対策）
    if (abs !== paths.src && !abs.startsWith(paths.src + path.sep)) continue

    // パーシャル・「_」始まりディレクトリはページとして配信しない
    const relFromSrc = path.relative(paths.src, abs)
    if (relFromSrc.split(path.sep).some(seg => seg.startsWith('_'))) continue

    if (existsSync(abs)) return abs
  }

  return null
}

/**
 * リクエスト時遅延ビルダーを生成する。
 * - 同一ページへの同時リクエストは 1 ビルドに統合（in-flight 重複排除）
 * - in-flight エントリはビルド開始時の世代付き。無効化後は古い in-flight に相乗りしない
 * - ビルド失敗時はエントリを必ず破棄（エラーはキャッシュしない）
 */
export function createLazyPageBuilder(context, buildFn = buildPageHtml) {
  const inflight = new Map() // pugFile -> { epoch, promise }

  return function getPage(pugFile) {
    const { cache } = context

    const cached = cache.getPageHtml(pugFile)
    if (cached !== undefined) return Promise.resolve(cached)

    const epoch = cache.getPageEpoch(pugFile)
    const entry = inflight.get(pugFile)
    if (entry && entry.epoch === epoch) return entry.promise

    const promise = buildFn(pugFile, context)
      .then(html => {
        cache.setPageHtml(pugFile, html, epoch)
        return html
      })
      .finally(() => {
        if (inflight.get(pugFile)?.promise === promise) inflight.delete(pugFile)
      })

    inflight.set(pugFile, { epoch, promise })
    return promise
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/**
 * ビルドエラー時に返すページ。ライブリロードスクリプト入りなので修正保存で自動復帰する。
 */
function buildErrorPage(pugFile, error, paths, errorPageScript) {
  const rel = path.relative(paths.src, pugFile)
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Build Error - pugkit</title>
<style>
  body { background: #1b1b1f; color: #e0e0e0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 40px; }
  h1 { color: #ff6b6b; font-size: 18px; }
  .file { color: #ffd166; margin-bottom: 16px; }
  pre { background: #111; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; line-height: 1.6; }
  p.hint { color: #888; font-size: 12px; }
</style>
</head>
<body>
<h1>Pug Build Error</h1>
<div class="file">${escapeHtml(rel)}</div>
<pre>${escapeHtml(error.message)}</pre>
<p class="hint">ファイルを修正して保存すると自動でリロードされます。</p>
${errorPageScript}
</body>
</html>`
}

function sendHtml(res, status, html, extraHeaders) {
  const buf = Buffer.from(html, 'utf-8')
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache',
    ...extraHeaders
  })
  res.end(buf)
}

export function injectReload(html, liveReloadScript) {
  // 置換文字列に第三者コードを渡すため、$& や $` が特殊解釈されないよう関数形式で置換する
  return html.includes('</body>')
    ? html.replace('</body>', () => liveReloadScript + '</body>')
    : html + liveReloadScript
}

/**
 * 開発サーバータスク（SSE + 遅延ビルド + sirv）
 */
export async function serverTask(context, options = {}) {
  const { paths, config } = context

  if (!existsSync(paths.dist)) {
    await mkdir(paths.dist, { recursive: true })
  }

  const port = config.server?.port ?? 5555
  const host = config.server?.host ?? 'localhost'
  const subdir = config.subdir ? '/' + config.subdir.replace(/^\/|\/$/g, '') : ''
  const startPath = (config.server?.startPath || '/').replace(/^\//, '')
  const fullStartPath = subdir ? `${subdir}/${startPath}` : `/${startPath}`

  const serveRoot = paths.outDir

  // DOM 差分更新（domDiff）はデフォルト有効。無効化するとフルリロードに戻る
  const domDiff = config.server?.domDiff !== false
  const liveReloadScript = createLiveReloadScript({ domDiff })
  const errorPageScript = createLiveReloadScript({ scroll: false, domDiff: false })

  const clients = new Set()
  const getPage = createLazyPageBuilder(context)
  // ページごとに直近で返した HTML の morph 可否判定用の指紋
  const morphSignatures = new Map()

  const sirvOptions = {
    dev: true,
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }
  }

  const staticServe = sirv(serveRoot, sirvOptions)

  // clean: false（既存環境への組み込み）のときだけ、build の出力先にある
  // 既存資産（レガシー HTML・手置きのファイル）を読み取り専用でフォールバック配信する。
  // clean: true では outDir の中身は前回ビルドの成果物でしかなく、src から削除した
  // ページが「復活」して見えてしまうため参照しない。dev がここに書き込むことはない
  const buildOutDir = paths.buildOutDir
  const useBuildOutDirFallback =
    config.build?.clean === false && buildOutDir && buildOutDir !== serveRoot && existsSync(buildOutDir)
  const fallbackServe = useBuildOutDirFallback ? sirv(buildOutDir, sirvOptions) : null

  const serveStatic = (req, res, notFound) => {
    staticServe(req, res, () => {
      if (fallbackServe) fallbackServe(req, res, notFound)
      else notFound()
    })
  }

  const httpServer = http.createServer((req, res) => {
    const urlPath = req.url?.split('?')[0] ?? '/'

    // ── SSE エンドポイント ──────────────────────────────
    if (urlPath === SSE_PATH) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      res.write('retry: 1000\n\n')
      clients.add(res)

      const cleanup = () => clients.delete(res)
      req.on('close', cleanup)
      req.socket.on('close', cleanup)
      res.on('error', cleanup)
      return
    }

    let decoded
    try {
      decoded = decodeURIComponent(urlPath)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('400 Bad Request')
      return
    }

    // ── Pug ページ: リクエスト時遅延ビルド + メモリ配信 ──
    const pugFile = resolvePugSource(decoded, paths, subdir)

    if (pugFile) {
      getPage(pugFile)
        .then(html => {
          // 前回そのページに返した HTML と <html> 属性・head・script が同じなら、
          // クライアントは body の差分適用だけで最新にできる
          const signature = computeMorphSignature(html)
          const previous = morphSignatures.get(pugFile)
          morphSignatures.set(pugFile, signature)
          const morphable = previous !== undefined && previous === signature
          sendHtml(res, 200, injectReload(html, liveReloadScript), {
            'X-Pugkit-Morphable': morphable ? '1' : '0'
          })
        })
        .catch(error => {
          if (!res.headersSent) sendHtml(res, 500, buildErrorPage(pugFile, error, paths, errorPageScript))
        })
      return
    }

    // ── 非Pugの既存HTML（public 由来、build 出力先のレガシーHTML）: 読み出し + スクリプト注入 ───
    const isInside = (p, root) => {
      const abs = path.resolve(p)
      return abs === root || abs.startsWith(root + path.sep)
    }
    const htmlCandidatesIn = root =>
      [
        path.join(root, decoded === '/' ? 'index.html' : decoded.replace(/\/$/, '') + '/index.html'),
        path.join(root, decoded === '/' ? 'index.html' : decoded + '.html'),
        path.join(root, decoded)
      ].filter(p => p.endsWith('.html') && isInside(p, root) && existsSync(p))

    const htmlFile =
      htmlCandidatesIn(serveRoot)[0] ?? (fallbackServe ? htmlCandidatesIn(buildOutDir)[0] : undefined)

    if (htmlFile) {
      readFile(htmlFile, 'utf-8')
        .then(html => {
          sendHtml(res, 200, injectReload(html, liveReloadScript))
        })
        .catch(() => {
          serveStatic(req, res, () => {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('404 Not Found')
          })
        })
      return
    }

    // ── sirv で静的ファイルを配信 ───────────────────────
    serveStatic(req, res, () => {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('404 Not Found')
    })
  })

  function broadcast(event, data = '') {
    const msg = `event: ${event}\ndata: ${data}\n\n`
    for (const res of clients) {
      try {
        res.write(msg)
      } catch {
        clients.delete(res)
      }
    }
  }

  context.server = {
    // 実際に待ち受けているポート（port: 0 を指定した場合は OS が割り当てた値）
    get port() {
      return httpServer.address()?.port ?? port
    },
    // kind: 'html' = Pug 由来の変更（DOM 差分更新の対象）、'full' = フルリロードが必要
    reload(kind = 'full') {
      broadcast('reload', kind)
    },
    reloadCSS() {
      broadcast('css-update')
    },
    close() {
      for (const res of clients) res.end()
      clients.clear()
      httpServer.close()
    }
  }

  return new Promise((resolve, reject) => {
    httpServer.listen(port, host, () => {
      logger.success('server', `Running at http://${host}:${port}${fullStartPath}`)
      resolve()
    })
    httpServer.on('error', reject)
  })
}

export default serverTask
