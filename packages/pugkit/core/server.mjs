import http from 'node:http'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import sirv from 'sirv'
import { logger } from '../utils/logger.mjs'
import { buildPageHtml } from '../tasks/pug.mjs'

const SSE_PATH = '/__pugkit_sse'

/**
 * HTMLに挿入するライブリロードクライアントスクリプト。
 * エラーページでは scroll 無効版を使う: 保存済みの位置を消費せず温存し、
 * エラーページ自身の位置（≒先頭）も保存しないことで、修正後のリロードで
 * エラー前のスクロール位置に戻れるようにする。
 */
function createLiveReloadScript({ scroll = true } = {}) {
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

  return `<script>
(function() {
  // リロード前に保存したスクロール位置を復元する（編集のたびに先頭へ戻るのを防ぐ）
  var scrollKey = '__pugkit_scroll:' + location.pathname;
  ${restoreScroll}
  function saveScroll() {
    ${saveScrollBody}
  }
  var es = new EventSource('${SSE_PATH}');
  es.addEventListener('reload', function() {
    saveScroll();
    location.reload();
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

const liveReloadScript = createLiveReloadScript()
const errorPageScript = createLiveReloadScript({ scroll: false })

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
function buildErrorPage(pugFile, error, paths) {
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

function sendHtml(res, status, html) {
  const buf = Buffer.from(html, 'utf-8')
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  })
  res.end(buf)
}

function injectReload(html) {
  return html.includes('</body>') ? html.replace('</body>', liveReloadScript + '</body>') : html + liveReloadScript
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

  const clients = new Set()
  const getPage = createLazyPageBuilder(context)

  const staticServe = sirv(serveRoot, {
    dev: true,
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }
  })

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
        .then(html => sendHtml(res, 200, injectReload(html)))
        .catch(error => {
          if (!res.headersSent) sendHtml(res, 500, buildErrorPage(pugFile, error, paths))
        })
      return
    }

    // ── 非Pugの既存HTML（public由来など）: dist読み出し + スクリプト注入 ───
    const candidates = [
      path.join(serveRoot, decoded === '/' ? 'index.html' : decoded.replace(/\/$/, '') + '/index.html'),
      path.join(serveRoot, decoded === '/' ? 'index.html' : decoded + '.html'),
      path.join(serveRoot, decoded)
    ]
    const isInsideServeRoot = p => {
      const abs = path.resolve(p)
      return abs === serveRoot || abs.startsWith(serveRoot + path.sep)
    }
    const htmlFile = candidates.find(p => p.endsWith('.html') && isInsideServeRoot(p) && existsSync(p))

    if (htmlFile) {
      readFile(htmlFile, 'utf-8')
        .then(html => {
          sendHtml(res, 200, injectReload(html))
        })
        .catch(() => {
          staticServe(req, res, () => {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('404 Not Found')
          })
        })
      return
    }

    // ── sirv で静的ファイルを配信 ───────────────────────
    staticServe(req, res, () => {
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
    reload() {
      broadcast('reload')
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
