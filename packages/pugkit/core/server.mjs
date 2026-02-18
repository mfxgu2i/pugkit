import browser from 'browser-sync'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { logger } from '../utils/logger.mjs'

/**
 * 開発サーバータスク
 */
export async function serverTask(context, options = {}) {
  const { paths, config } = context
  const distRoot = paths.dist

  // distディレクトリの確認
  if (!existsSync(distRoot)) {
    await mkdir(distRoot, { recursive: true })
  }

  // BrowserSyncインスタンス作成
  const bs = browser.create()
  context.server = bs

  const subdir = config.subdir ? '/' + config.subdir.replace(/^\/|\/$/g, '') : ''
  const startPath = (config.server.startPath || '/').replace(/^\//, '')
  const fullStartPath = subdir ? `${subdir}/${startPath}` : `/${startPath}`

  return new Promise((resolve, reject) => {
    bs.init(
      {
        notify: false,
        server: {
          baseDir: distRoot,
          serveStaticOptions: {
            extensions: ['html'],
            setHeaders: (res, path) => {
              if (path.endsWith('.css') || path.endsWith('.js')) {
                res.setHeader('Cache-Control', 'no-cache')
              }
            }
          }
        },
        open: false,
        scrollProportionally: false,
        ghostMode: false,
        ui: false,
        startPath: fullStartPath,
        port: config.server.port,
        host: config.server.host,
        socket: {
          namespace: '/browser-sync'
        },
        logLevel: 'silent',
        logFileChanges: false,
        logConnections: false,
        minify: false,
        timestamps: false,
        codeSync: true,
        online: false,
        files: false, // 手動でリロード制御
        injectChanges: true,
        reloadDelay: 0,
        reloadDebounce: 50
      },
      err => {
        if (err) {
          logger.error('server', err.message)
          reject(err)
        } else {
          const urls = bs.getOption('urls')
          logger.success('server', `Running at ${urls.get('local')}`)
          resolve()
        }
      }
    )
  })
}

export default serverTask
