import http from 'node:http'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import sirv from 'sirv'
import { logger } from '../utils/logger.mjs'
import { publicOverrideFor } from '../utils/page-conflict.mjs'
import { subdirPrefix } from '../utils/subdir.mjs'
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

/** 注入したスクリプトの目印。dev の注入分を機械的に見分けるために使う */
const RELOAD_ATTR = 'data-pugkit-live-reload'

/** 注入するスクリプトに埋め込む指紋の属性名。クライアントもこの名前で読む */
const SIGNATURE_ATTR = 'data-pugkit-signature'

/**
 * body の差分適用で反映できない部分（<html> の属性・head・<script>）の指紋。
 * 表示中の HTML と取得した HTML で一致していれば差分適用してよい。
 *
 * 実行時に差し込まれる要素（解析タグ・同意バナー等）の影響を受けないよう、
 * ライブ DOM ではなくサーバー生成の HTML から算出する。
 */
export function computeMorphSignature(html) {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const scripts = html.match(/<script\b[\s\S]*?<\/script>/gi)?.join('') ?? ''
  return createHash('md5').update(`${htmlTag}\u0000${head}\u0000${scripts}`).digest('hex')
}

/**
 * 注入するクライアントスクリプト。実ファイルを読むだけで、組み立ては行わない。
 * 設定はタグの data 属性で渡す（client/live-reload.js を参照）。
 */
let clientSource
function loadClientSource() {
  if (clientSource === undefined) {
    clientSource = readFileSync(new URL('../client/live-reload.js', import.meta.url), 'utf8')
  }
  return clientSource
}

/**
 * 注入するスクリプトタグ。
 *
 * 指紋を属性として持たせ、タブ自身が「今表示している HTML の指紋」を覚えられるようにする。
 * サーバーは直近の指紋を覚えないので、同じページを何タブ開いても判定が狂わない。
 *
 * - domDiff: Pug の変更を location.reload() ではなく DOM の差分適用で反映する。
 *   スクロール位置・フォーム入力・遅延読み込み済み画像が保持される。
 *   idiomorph を読めないときは同梱せず、クライアントはフルリロードに退避する。
 * - scroll: エラーページでは無効にする。保存済みの位置を消費せず温存し、
 *   エラーページ自身の位置（≒先頭）も保存しないことで、修正後のリロードで
 *   エラー前の位置に戻れるようにする。
 */
function createReloadTag({ signature = '', scroll = true, domDiff = true } = {}) {
  const idiomorph = domDiff ? loadIdiomorphSource() : null
  const attrs = [
    RELOAD_ATTR,
    `data-sse="${SSE_PATH}"`,
    ...(signature ? [`${SIGNATURE_ATTR}="${signature}"`] : []),
    ...(scroll ? [] : ['data-scroll="0"']),
    ...(idiomorph ? [] : ['data-dom-diff="0"'])
  ].join(' ')

  return `<script ${attrs}>\n${idiomorph ?? ''}\n${loadClientSource()}</script>`
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

/**
 * 静的配信の失敗を受け止める包み。
 *
 * sirv はファイルの存在を確認してから読み出すが、その間に消える可能性を扱っていない。
 * dev では watcher の削除・キャッシュの作り直しと配信が日常的に競合するため、
 * 素のまま使うと dev サーバーがプロセスごと落ちる（エラーページも自動復帰も無い）。
 *
 * 失敗の出方が2通りあるので両方を受け止める:
 *   - 存在確認（statSync）の失敗 → 同期 throw。ここで catch する
 *   - 読み出し（createReadStream）の失敗 → ストリームの 'error'。
 *     配信先の 'pipe' イベントで読み取り元を掴んで listener を付ける
 *
 * 応答を始めた後は本文の続きを送れないので接続を切る。まだなら次の候補に回す。
 */
export function guardStaticServe(serve, onError = () => {}) {
  return (req, res, next) => {
    const fail = error => {
      onError(error)
      res.destroy()
    }

    res.once('pipe', source => source.on('error', fail))

    try {
      serve(req, res, next)
    } catch (error) {
      onError(error)
      if (res.headersSent) res.destroy()
      else next()
    }
  }
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

  if (!existsSync(paths.output)) {
    await mkdir(paths.output, { recursive: true })
  }

  const port = config.server?.port ?? 5555
  const host = config.server?.host ?? 'localhost'
  const subdir = subdirPrefix(config.subdir)
  const startPath = (config.server?.startPath || '/').replace(/^\//, '')
  const fullStartPath = subdir ? `${subdir}/${startPath}` : `/${startPath}`

  const serveRoot = paths.outputRoot

  // DOM 差分更新（domDiff）はデフォルト有効。無効化するとフルリロードに戻る
  const domDiff = config.server?.domDiff !== false
  // 指紋を持たないタグは常にフルリロードになる。
  // エラーページと、Pug 由来でない既存 HTML（内容の作られ方を pugkit が知らない）が対象
  const errorPageTag = createReloadTag({ scroll: false, domDiff: false })
  const staticPageTag = createReloadTag({ domDiff })

  const clients = new Set()
  const getPage = createLazyPageBuilder(context)

  const sirvOptions = {
    dev: true,
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }
  }

  // 配信するのは src から導かれるものだけ。build の出力先は参照しない
  // （前回ビルドの成果物が現在のソースの代わりに見えたり、src から消したページが
  //   復活したりする）。outDir にしか無いファイルは public/ に置けば dev でも扱える
  const serveStatic = guardStaticServe(sirv(serveRoot, sirvOptions), error =>
    logger.warn('server', `配信に失敗しました: ${error.message}`)
  )

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
    // public に同名の HTML があれば build では copy が Pug の出力を上書きする。
    // dev だけ Pug を返すと「dev で見たページが本番に出ない」ことになるので合わせる
    const pugSource = resolvePugSource(decoded, paths, subdir)
    const pugFile = pugSource && publicOverrideFor(pugSource, paths) ? null : pugSource

    if (pugFile) {
      getPage(pugFile)
        .then(html => {
          // 指紋は判定結果ではなく値として渡す。差分適用してよいかは、
          // それぞれのタブが自分の持つ指紋と比べて決める
          sendHtml(res, 200, injectReload(html, createReloadTag({ signature: computeMorphSignature(html), domDiff })))
        })
        .catch(error => {
          if (!res.headersSent) sendHtml(res, 500, buildErrorPage(pugFile, error, paths, errorPageTag))
        })
      return
    }

    // ── 非Pugの既存HTML（public 由来）: 読み出し + スクリプト注入 ───
    const isInside = (p, root) => {
      const abs = path.resolve(p)
      return abs === root || abs.startsWith(root + path.sep)
    }
    // 候補順は sirv・resolvePugSource と揃える（フラットファイル優先、
    // 末尾スラッシュは先に除去して同順）。ここだけ順序が違うと、同じ形の URL でも
    // Pug ページと public 由来の HTML で別の階層のファイルが選ばれてしまう
    const base = decoded !== '/' ? decoded.replace(/\/+$/, '') : decoded
    const htmlCandidatesIn = root =>
      (base === '/'
        ? [path.join(root, 'index.html')]
        : [path.join(root, base), path.join(root, `${base}.html`), path.join(root, base, 'index.html')]
      ).filter(p => p.endsWith('.html') && isInside(p, root) && existsSync(p))

    const htmlFile = htmlCandidatesIn(serveRoot)[0]

    if (htmlFile) {
      readFile(htmlFile, 'utf-8')
        .then(html => {
          sendHtml(res, 200, injectReload(html, staticPageTag))
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
    // 繋がっているブラウザの数。切断されたものが残り続けていないか確かめられる
    get clientCount() {
      return clients.size
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
