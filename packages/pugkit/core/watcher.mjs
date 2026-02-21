import chokidar from 'chokidar'
import { relative } from 'node:path'
import { logger } from '../utils/logger.mjs'

/**
 * ファイル監視タスク
 */
export async function watcherTask(context, options = {}) {
  const watcher = new FileWatcher(context)
  await watcher.start()
}

/**
 * ファイルウォッチャー
 */
class FileWatcher {
  constructor(context) {
    this.context = context
    this.watchers = []
  }

  async start() {
    const { paths } = this.context

    // 初回ビルド（依存関係グラフ構築のため）
    logger.info('watch', 'Building initial dependency graph...')
    if (this.context.taskRegistry?.pug) {
      await this.context.taskRegistry.pug(this.context)
    }

    // Pug監視
    this.watchPug(paths.src)

    // Sass監視
    this.watchSass(paths.src)

    // Script監視
    this.watchScript(paths.src)

    // SVG監視
    this.watchSvg(paths.src)

    // 画像監視
    this.watchImages(paths.src)

    // Public監視
    this.watchPublic(paths.public)

    logger.info('watch', 'File watching started')
  }

  /**
   * Pug監視（依存関係を考慮）
   */
  watchPug(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [
        /(^|[\/\\])\../, // 隠しファイル
        /node_modules/,
        /\.git/
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    })

    watcher.on('change', async path => {
      // .pugファイルのみ処理
      if (!path.endsWith('.pug')) {
        return
      }
      const relPath = relative(basePath, path)
      logger.info('change', `pug: ${relPath}`)

      try {
        // パーシャルの場合、依存する親ファイルも再ビルド
        const affectedFiles = this.context.graph.getAffectedParents(path)

        if (affectedFiles.length > 0) {
          logger.info('pug', `Rebuilding ${affectedFiles.length} affected file(s)`)
        }

        // キャッシュ無効化
        this.context.cache.invalidatePugTemplate(path)
        affectedFiles.forEach(f => this.context.cache.invalidatePugTemplate(f))

        // Pugタスクを実行（変更されたファイルのみ）
        if (this.context.taskRegistry?.pug) {
          await this.context.taskRegistry.pug(this.context, {
            files: [path, ...affectedFiles]
          })
        }

        this.reload()
      } catch (error) {
        logger.error('watch', `Pug build failed: ${error.message}`)
      }
    })

    this.watchers.push(watcher)
  }

  /**
   * Sass監視
   */
  watchSass(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [/(^|[\/\\])\../, /node_modules/, /\.git/],
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })

    watcher.on('change', async path => {
      // .scssファイルのみ処理
      if (!path.endsWith('.scss')) {
        return
      }
      const relPath = relative(basePath, path)
      logger.info('change', `sass: ${relPath}`)

      try {
        // Sassタスクを実行
        if (this.context.taskRegistry?.sass) {
          await this.context.taskRegistry.sass(this.context)
        }

        // CSSはインジェクション
        const cssUrlPath = '/' + relPath.replace(/\\/g, '/').replace(/\.scss$/, '.css')
        this.injectCSS(cssUrlPath)
      } catch (error) {
        logger.error('watch', `Sass build failed: ${error.message}`)
      }
    })

    this.watchers.push(watcher)
  }

  /**
   * Script監視
   */
  watchScript(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [/(^|[\/\\])\../, /node_modules/, /\.git/, /\.d\.ts$/],
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })

    watcher.on('change', async path => {
      // .ts/.jsファイルのみ処理（.d.tsを除く）
      if (!(path.endsWith('.ts') || path.endsWith('.js')) || path.endsWith('.d.ts')) {
        return
      }
      const relPath = relative(basePath, path)
      logger.info('change', `script: ${relPath}`)

      try {
        // Scriptタスクを実行
        if (this.context.taskRegistry?.script) {
          await this.context.taskRegistry.script(this.context)
        }

        this.reload()
      } catch (error) {
        logger.error('watch', `Script build failed: ${error.message}`)
      }
    })

    this.watchers.push(watcher)
  }

  /**
   * SVG監視
   */
  watchSvg(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [/(^|[\/\\])\../, /node_modules/, /\.git/, /icons/], // iconsはスプライト用なので除外
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })

    const handleSvgChange = async path => {
      // .svgファイルのみ処理（iconsディレクトリは除外）
      // Windows対応: パスセパレータを正規化
      const normalizedPath = path.replace(/\\/g, '/')
      if (!path.endsWith('.svg') || normalizedPath.includes('/icons/')) {
        return
      }
      const relPath = relative(basePath, path)
      logger.info('change', `svg: ${relPath}`)

      try {
        // SVGタスクを実行（変更されたファイルのみ）
        if (this.context.taskRegistry?.svg) {
          await this.context.taskRegistry.svg(this.context, {
            files: [path]
          })
        }

        this.reload()
      } catch (error) {
        logger.error('watch', `SVG processing failed: ${error.message}`)
      }
    }

    watcher.on('change', handleSvgChange)
    watcher.on('add', handleSvgChange)

    this.watchers.push(watcher)
  }

  /**
   * 画像監視
   */
  watchImages(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [/(^|[\/\\])\../, /node_modules/, /\.git/],
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })

    const handleImageChange = async path => {
      // 画像ファイルのみ処理
      if (!/\.(jpg|jpeg|png|gif)$/i.test(path)) {
        return
      }
      const relPath = relative(basePath, path)
      logger.info('change', `image: ${relPath}`)

      try {
        // 追加・変更時: 画像を処理
        if (this.context.taskRegistry?.image) {
          await this.context.taskRegistry.image(this.context, {
            files: [path]
          })
        }

        this.reload()
      } catch (error) {
        logger.error('watch', `Image processing failed: ${error.message}`)
      }
    }

    watcher.on('change', handleImageChange)
    watcher.on('add', handleImageChange)

    this.watchers.push(watcher)
  }

  /**
   * Public監視
   */
  watchPublic(basePath) {
    const watcher = chokidar.watch(basePath, {
      ignoreInitial: true,
      ignored: [/(^|[\/\\])\../, /node_modules/, /\.git/],
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    })

    watcher.on('change', async path => {
      const relPath = relative(basePath, path)
      logger.info('change', `public: ${relPath}`)

      try {
        // Copyタスクを実行
        if (this.context.taskRegistry?.copy) {
          await this.context.taskRegistry.copy(this.context)
        }

        this.reload()
      } catch (error) {
        logger.error('watch', `Copy failed: ${error.message}`)
      }
    })

    this.watchers.push(watcher)
  }

  /**
   * ブラウザリロード
   */
  reload() {
    if (this.context.server) {
      setTimeout(() => {
        this.context.server.reload()
      }, 100)
    }
  }

  /**
   * CSSインジェクション
   */
  injectCSS() {
    if (this.context.server) {
      setTimeout(() => {
        this.context.server.reloadCSS()
      }, 100)
    }
  }

  /**
   * 監視停止
   */
  async stop() {
    await Promise.all(this.watchers.map(w => w.close()))
    logger.info('watch', 'File watching stopped')
  }
}

export default watcherTask
