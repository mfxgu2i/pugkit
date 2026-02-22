import http from 'node:http'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import sirv from 'sirv'
import { logger } from '../utils/logger.mjs'

const SSE_PATH = '/__pugkit_sse'

/**
 * HTMLに挿入するライブリロードクライアントスクリプト。
 */
const liveReloadScript = `<script>
(function() {
  var es = new EventSource('${SSE_PATH}');
  es.addEventListener('reload', function() {
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
    setTimeout(function() { location.reload(); }, 1000);
  };
  window.addEventListener('beforeunload', function() {
    es.close();
  });
})();
</script>`

/**
 * 開発サーバータスク（SSE + sirv）
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

  const clients = new Set()

  const staticServe = sirv(paths.dist, {
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

    // ── HTML へのライブリロードスクリプト注入 ───────────
    const decoded = decodeURIComponent(urlPath)
    const candidates = [
      path.join(paths.dist, decoded === '/' ? 'index.html' : decoded.replace(/\/$/, '') + '/index.html'),
      path.join(paths.dist, decoded === '/' ? 'index.html' : decoded + '.html'),
      path.join(paths.dist, decoded)
    ]
    const htmlFile = candidates.find(p => p.endsWith('.html') && existsSync(p))

    if (htmlFile) {
      readFile(htmlFile, 'utf-8')
        .then(html => {
          html = html.includes('</body>')
            ? html.replace('</body>', liveReloadScript + '</body>')
            : html + liveReloadScript
          const buf = Buffer.from(html, 'utf-8')
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': buf.length,
            'Cache-Control': 'no-cache'
          })
          res.end(buf)
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
