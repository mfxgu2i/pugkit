import http from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import sirv from 'sirv'
import { logger } from '../utils/logger.mjs'
import { serverAddress } from '../config/defaults.mjs'
import { publicOverrideFor } from '../utils/page-conflict.mjs'
import { subdirPrefix } from '../utils/subdir.mjs'
import { SSE_PATH, computeMorphSignature, createReloadTag } from './dev/client-script.mjs'
import { resolvePugSource } from './dev/page-source.mjs'
import { resolvePageFile } from '../utils/page-candidates.mjs'
import { createLazyPageBuilder } from './dev/lazy-builder.mjs'
import { createWidthImageResponder } from './dev/width-images.mjs'
import { buildErrorPage, guardStaticServe, injectReload, sendHtml } from './dev/response.mjs'

/**
 * 開発サーバータスク（SSE + 遅延ビルド + sirv）
 */
export async function serverTask(context, options = {}) {
  const { paths, config } = context

  if (!existsSync(paths.output)) {
    await mkdir(paths.output, { recursive: true })
  }

  const { port, host } = serverAddress(config)
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
  // 幅違いは起動時に作らず、要求された時点で作る（docs/adr/0011）
  const getWidthImage = createWidthImageResponder(context, subdir)

  const sirvOptions = {
    dev: true,
    extensions: ['html'],
    // dev では常に取り直させる。画像や SVG も差し替えた瞬間に反映したい
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache')
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
    // 候補順は resolvePugSource と同じ規則から導く（page-candidates.mjs）。
    // ここだけ順序が違うと、同じ形の URL でも Pug ページと public 由来の HTML で
    // 別の階層のファイルが選ばれてしまう。
    // subdir を外さないのは、配信ルート（outputRoot）配下に subdir ごと書かれるため
    const htmlFile = resolvePageFile(decoded, serveRoot, '.html')

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

    // ── 幅違いの画像: リクエスト時生成 ──────────────────
    // 作れないもの（対象外の形式・原寸以上・上限超え・既に置かれている）は null が返り、
    // そのまま sirv に落ちる。sirv に委譲せず自分で返すのは、
    // decodeURIComponent と sirv の decodeURI が食い違うため
    getWidthImage(decoded)
      .then(image => {
        if (!image) {
          serveStatic(req, res, () => {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('404 Not Found')
          })
          return
        }

        res.writeHead(200, { 'Content-Type': image.contentType, 'Cache-Control': 'no-cache' })
        createReadStream(image.path).pipe(res)
      })
      .catch(() => {
        if (res.headersSent) return
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
      // 要求値ではなく実際に待ち受けたポートを出す。
      // port: 0 は「OS に空きを割り当てさせる」指定なので、要求値を出すと
      // `http://localhost:0/` という開けない URL を案内することになる
      logger.success('server', `Running at http://${host}:${context.server.port}${fullStartPath}`)
      resolve()
    })
    httpServer.on('error', reject)
  })
}

export default serverTask
