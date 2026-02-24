import chokidar from 'chokidar'
import { rm } from 'node:fs/promises'
import { relative, resolve, basename, extname } from 'node:path'
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
    this.watcher = null
  }

  async start() {
    const { paths } = this.context

    // 初回ビルド（依存関係グラフ構築のため）
    logger.info('watch', 'Building initial dependency graph...')
    if (this.context.taskRegistry?.pug) {
      await this.context.taskRegistry.pug(this.context)
    }

    this.watcher = chokidar
      .watch([paths.src, paths.public], {
        ignoreInitial: true,
        ignored: [/(^|[\/\\])\./, /node_modules/, /\.git/],
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
      })
      .on('change', filePath => this.handleChange(filePath))
      .on('add', filePath => this.handleAdd(filePath))
      .on('unlink', filePath => this.handleUnlink(filePath))

    logger.info('watch', 'File watching started')
  }

  // ---- ルーティング ----
  handleChange(filePath) {
    if (this.isPublic(filePath)) return this.onPublicChange(filePath, 'change')
    if (filePath.endsWith('.pug')) return this.onPugChange(filePath)
    if (filePath.endsWith('.scss')) return this.onSassChange(filePath)
    if (this.isScript(filePath)) return this.onScriptChange(filePath)
    if (filePath.endsWith('.svg') && !this.isIcons(filePath)) return this.onSvgChange(filePath, 'change')
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageChange(filePath, 'change')
  }

  handleAdd(filePath) {
    if (this.isPublic(filePath)) return this.onPublicChange(filePath, 'add')
    if (filePath.endsWith('.svg') && !this.isIcons(filePath)) return this.onSvgChange(filePath, 'add')
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageChange(filePath, 'add')
  }

  handleUnlink(filePath) {
    if (this.isPublic(filePath)) return this.onPublicUnlink(filePath)
    if (filePath.endsWith('.pug')) return this.onPugUnlink(filePath)
    if (filePath.endsWith('.scss')) return this.onSassUnlink(filePath)
    if (this.isScript(filePath)) return this.onScriptUnlink(filePath)
    if (filePath.endsWith('.svg') && !this.isIcons(filePath)) return this.onSvgUnlink(filePath)
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageUnlink(filePath)
  }

  // ---- 判定ヘルパー ----

  isPublic(filePath) {
    return filePath.startsWith(this.context.paths.public)
  }

  isScript(filePath) {
    return (filePath.endsWith('.ts') || filePath.endsWith('.js')) && !filePath.endsWith('.d.ts')
  }

  isIcons(filePath) {
    // Windows 対応: セパレータを正規化
    return filePath.replace(/\\/g, '/').includes('/icons/')
  }

  // ---- Pug ----

  async onPugChange(filePath) {
    const { paths, graph, cache, taskRegistry } = this.context
    const relPath = relative(paths.src, filePath)
    logger.info('change', `pug: ${relPath}`)
    try {
      const affectedFiles = graph.getAffectedParents(filePath)
      if (affectedFiles.length > 0) logger.info('pug', `Rebuilding ${affectedFiles.length} affected file(s)`)
      cache.invalidatePugTemplate(filePath)
      affectedFiles.forEach(f => cache.invalidatePugTemplate(f))
      if (taskRegistry?.pug) {
        await taskRegistry.pug(this.context, { files: [filePath, ...affectedFiles] })
      }
      this.reload()
    } catch (error) {
      logger.error('watch', `Pug build failed: ${error.message}`)
    }
  }

  async onPugUnlink(filePath) {
    const { paths, cache, graph } = this.context
    const relPath = relative(paths.src, filePath)
    cache.invalidatePugTemplate(filePath)
    graph.clearDependencies(filePath)
    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      return
    }
    const distPath = resolve(paths.dist, relPath.replace(/\.pug$/, '.html'))
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Sass ----

  async onSassChange(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info('change', `sass: ${relPath}`)
    try {
      if (this.context.taskRegistry?.sass) await this.context.taskRegistry.sass(this.context)
      this.injectCSS()
    } catch (error) {
      logger.error('watch', `Sass build failed: ${error.message}`)
    }
  }

  async onSassUnlink(filePath) {
    const { paths } = this.context
    const relPath = relative(paths.src, filePath)
    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      return
    }
    const distPath = resolve(paths.dist, relPath.replace(/\.scss$/, '.css'))
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Script ----

  async onScriptChange(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info('change', `script: ${relPath}`)
    try {
      if (this.context.taskRegistry?.script) await this.context.taskRegistry.script(this.context)
      this.reload()
    } catch (error) {
      logger.error('watch', `Script build failed: ${error.message}`)
    }
  }

  async onScriptUnlink(filePath) {
    const { paths } = this.context
    const relPath = relative(paths.src, filePath)
    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      return
    }
    const distPath = resolve(paths.dist, relPath.replace(/\.ts$/, '.js'))
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- SVG ----

  async onSvgChange(filePath, event) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `svg: ${relPath}`)
    try {
      if (this.context.taskRegistry?.svg) {
        await this.context.taskRegistry.svg(this.context, { files: [filePath] })
      }
      this.reload()
    } catch (error) {
      logger.error('watch', `SVG processing failed: ${error.message}`)
    }
  }

  async onSvgUnlink(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    const distPath = resolve(this.context.paths.dist, relPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Image ----

  async onImageChange(filePath, event) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `image: ${relPath}`)
    try {
      if (this.context.taskRegistry?.image) {
        await this.context.taskRegistry.image(this.context, { files: [filePath] })
      }
      this.reload()
    } catch (error) {
      logger.error('watch', `Image processing failed: ${error.message}`)
    }
  }

  async onImageUnlink(filePath) {
    const { paths, config } = this.context
    const relPath = relative(paths.src, filePath)
    const useWebp = config.build.imageOptimization === 'webp'
    const ext = extname(filePath)
    const destRelPath = useWebp ? relPath.replace(new RegExp(`\\${ext}$`, 'i'), '.webp') : relPath
    const distPath = resolve(paths.dist, destRelPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Public ----

  async onPublicChange(filePath, event) {
    const relPath = relative(this.context.paths.public, filePath)
    logger.info(event, `public: ${relPath}`)
    try {
      if (this.context.taskRegistry?.copy) await this.context.taskRegistry.copy(this.context)
      this.reload()
    } catch (error) {
      logger.error('watch', `Copy failed: ${error.message}`)
    }
  }

  async onPublicUnlink(filePath) {
    const relPath = relative(this.context.paths.public, filePath)
    const distPath = resolve(this.context.paths.dist, relPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- 共通ヘルパー ----

  reload() {
    if (this.context.server) {
      setTimeout(() => {
        this.context.server.reload()
      }, 100)
    }
  }

  async deleteDistFile(distPath, relPath) {
    try {
      await rm(distPath, { force: true })
      logger.info('unlink', relPath)
      this.reload()
    } catch (error) {
      logger.error('watch', `Failed to delete ${relPath}: ${error.message}`)
    }
  }

  injectCSS() {
    if (this.context.server) {
      this.context.server.reloadCSS()
    }
  }

  async stop() {
    if (this.watcher) await this.watcher.close()
    logger.info('watch', 'File watching stopped')
  }
}

export default watcherTask
