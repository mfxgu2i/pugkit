import chokidar from 'chokidar'
import { rm } from 'node:fs/promises'
import { relative, resolve, basename, extname, sep } from 'node:path'
import net from 'node:net'
import { logger } from '../utils/logger.mjs'
import { resetDevCache } from '../utils/file.mjs'
import { clearImageSizeCache } from '../transform/image-size.mjs'

// Pug（HTML）だけは遅延ビルド + メモリ配信なので事前生成しない。
// 他は実ファイルとして配信するため、出力先が空の状態でも表示できるよう起動時に作る
const INITIAL_DEV_TASKS = ['sass', 'script', 'image', 'svg', 'sprite', 'copy']

const DEFAULT_PORT = 5555
const DEFAULT_HOST = 'localhost'

/**
 * ファイル監視タスク
 */
export async function watcherTask(context, options = {}) {
  const watcher = new FileWatcher(context, options.runTask)
  await watcher.start()
  return watcher
}

/**
 * ファイルウォッチャー
 *
 * Pug は遅延ビルド方式: 変更イベントではキャッシュ無効化とリロード通知のみ行い、
 * ビルドはブラウザが該当ページをリクエストした時に dev サーバー側で実行される。
 * Sass / Script は従来どおりイベント駆動でインクリメンタルビルドする。
 *
 * @param runTask タスク名で実行する関数。未指定なら再ビルドを伴う処理は行わない
 */
export class FileWatcher {
  constructor(context, runTask) {
    this.context = context
    this.runTask = runTask ?? (() => Promise.resolve())
    this.watcher = null
  }

  async start() {
    const { paths, config } = this.context

    // キャッシュを消す前にポートを確認する。既に別の dev サーバーが動いていると、
    // 消した瞬間に相手の配信が壊れるため、その前に起動を中止する
    await this.assertPortAvailable(config.server?.port ?? DEFAULT_PORT, config.server?.host ?? DEFAULT_HOST)

    // dev の出力先はツール専用のキャッシュなので毎回作り直してよい。
    // 前回セッションの残骸（削除済みソースの生成物）が配信されるのを防ぎ、
    // 「dev で見えているもの = 現在の src」を保証する
    try {
      await resetDevCache(paths.outDir)
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(
          `dev の出力先 "${paths.outDir}" に書き込めません。cacheDir に書き込み可能なパスを指定してください`
        )
      }
      throw error
    }

    // Pug 以外は初期ビルドする。Pug（HTML）だけは遅延ビルド + メモリ配信なので
    // 事前生成が不要で、依存グラフもページが最初にリクエストされた時に構築される。
    // 一方 CSS / JS / 画像 / SVG / public は実ファイルとして配信するため、
    // 出力ディレクトリが空の状態でも表示できるよう起動時に生成しておく
    await Promise.all(INITIAL_DEV_TASKS.map(name => this.runTask(name)))

    this.watcher = chokidar
      .watch([paths.src, paths.public], {
        ignoreInitial: true,
        ignored: [/(^|[\/\\])\./, /node_modules/, /\.git/],
        persistent: true,
        // 書き込み安定待ちは検知レイテンシに直結する。テキストファイル中心の
        // ソースでは 50ms の安定確認で十分（旧: 100ms 安定 + 100ms ポーリングで
        // 実効 100〜200ms）。途中書き込みを読んでもエラーページ → 次の保存で
        // 自動復帰する構造のためリスクは限定的
        awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 }
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
    if (filePath.endsWith('.svg') && this.isIcons(filePath)) return this.onSpriteChange(filePath, 'change')
    if (this.isHiddenAsset(filePath)) return
    if (filePath.endsWith('.svg')) return this.onSvgChange(filePath, 'change')
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageChange(filePath, 'change')
  }

  handleAdd(filePath) {
    if (this.isPublic(filePath)) return this.onPublicChange(filePath, 'add')
    if (filePath.endsWith('.pug')) return this.onPugChange(filePath)
    if (filePath.endsWith('.scss')) return this.onSassChange(filePath)
    if (this.isScript(filePath)) return this.onScriptChange(filePath)
    if (filePath.endsWith('.svg') && this.isIcons(filePath)) return this.onSpriteChange(filePath, 'add')
    if (this.isHiddenAsset(filePath)) return
    if (filePath.endsWith('.svg')) return this.onSvgChange(filePath, 'add')
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageChange(filePath, 'add')
  }

  handleUnlink(filePath) {
    if (this.isPublic(filePath)) return this.onPublicUnlink(filePath)
    if (filePath.endsWith('.pug')) return this.onPugUnlink(filePath)
    if (filePath.endsWith('.scss')) return this.onSassUnlink(filePath)
    if (this.isScript(filePath)) return this.onScriptUnlink(filePath)
    if (filePath.endsWith('.svg') && this.isIcons(filePath)) return this.onSpriteChange(filePath, 'unlink')
    if (this.isHiddenAsset(filePath)) return
    if (filePath.endsWith('.svg')) return this.onSvgUnlink(filePath)
    if (/\.(jpg|jpeg|png|gif)$/i.test(filePath)) return this.onImageUnlink(filePath)
  }

  /**
   * ポートが使用可能か確認する。使用中なら起動を中止する。
   */
  assertPortAvailable(port, host) {
    return new Promise((resolve, reject) => {
      const tester = net
        .createServer()
        .once('error', error => {
          if (error.code === 'EADDRINUSE') {
            reject(
              new Error(`ポート ${port} は既に使用されています。別の dev サーバーが起動していないか確認してください`)
            )
            return
          }
          reject(error)
        })
        .once('listening', () => tester.close(() => resolve()))
        .listen(port, host)
    })
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

  /**
   * 「_」始まりのファイル・ディレクトリ配下のアセット。
   * build では glob の ignore で出力対象外なので dev でも出力しない
   */
  isHiddenAsset(filePath) {
    return relative(this.context.paths.src, filePath)
      .split(sep)
      .some(segment => segment.startsWith('_'))
  }

  isImageAsset(filePath) {
    return /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(filePath)
  }

  // ---- Pug ----

  onPugChange(filePath) {
    const { paths, graph, cache } = this.context
    const relPath = relative(paths.src, filePath)
    logger.info('change', `pug: ${relPath}`)

    // 影響を受ける親ページを含めてキャッシュ無効化のみ行う。
    // ビルドはリクエスト時に行われるため、ここでは何もビルドしない
    const affected = graph.getAffectedParents(filePath)
    if (affected.length > 0) logger.info('pug', `Invalidated ${affected.length} affected page(s)`)

    for (const file of [filePath, ...affected]) {
      cache.invalidatePugTemplate(file)
      cache.invalidatePageHtml(file)
    }

    this.reload('html')
  }

  async onPugUnlink(filePath) {
    const { paths, cache, graph, imageGraph } = this.context
    const relPath = relative(paths.src, filePath)

    // removeFile の前に影響親を取得する（後だと逆引きが消えて取得できない）
    const affected = graph.getAffectedParents(filePath)
    for (const file of affected) {
      cache.invalidatePugTemplate(file)
      cache.invalidatePageHtml(file)
    }

    cache.invalidatePugTemplate(filePath)
    cache.invalidatePageHtml(filePath)
    graph.removeFile(filePath)
    imageGraph.removeFile(filePath)

    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      this.reload('html')
      return
    }

    logger.info('unlink', relPath)
    this.reload('full')
  }

  // ---- Sass ----

  async onSassChange(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info('change', `sass: ${relPath}`)
    try {
      await this.runTask('sass', { files: [filePath] })
      this.injectCSS()
    } catch (error) {
      logger.error('watch', `Sass build failed: ${error.message}`)
    }
  }

  async onSassUnlink(filePath) {
    const { paths, sassGraph } = this.context
    const relPath = relative(paths.src, filePath)
    sassGraph.removeFile(filePath)
    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      return
    }
    const distPath = resolve(paths.dist, relPath.replace(/\.scss$/, '.css'))
    await this.deleteDistFile(distPath, relPath, { withSourceMap: true })
  }

  // ---- Script ----

  async onScriptChange(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info('change', `script: ${relPath}`)
    try {
      await this.runTask('script', { files: [filePath] })
      this.reload()
    } catch (error) {
      logger.error('watch', `Script build failed: ${error.message}`)
    }
  }

  async onScriptUnlink(filePath) {
    const { paths, scriptGraph } = this.context
    const relPath = relative(paths.src, filePath)
    scriptGraph.removeFile(filePath)
    if (basename(filePath).startsWith('_')) {
      logger.info('unlink', relPath)
      return
    }
    const distPath = resolve(paths.dist, relPath.replace(/\.ts$/, '.js'))
    await this.deleteDistFile(distPath, relPath, { withSourceMap: true })
  }

  // ---- SVG ----

  async onSvgChange(filePath, event) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `svg: ${relPath}`)
    try {
      await this.runTask('svg', { files: [filePath] })
      this.invalidateAssetDependents(filePath, event)
      this.reload()
    } catch (error) {
      logger.error('watch', `SVG processing failed: ${error.message}`)
    }
  }

  // ---- SVG スプライト（icons/ 配下） ----

  async onSpriteChange(filePath, event) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `sprite: ${relPath}`)
    try {
      // スプライトは icons ディレクトリ全体から1ファイルを生成するため常に全再生成
      await this.runTask('sprite')
      // <use href> の参照先が変わるので取り直しが必要
      this.reload('full')
    } catch (error) {
      logger.error('watch', `Sprite generation failed: ${error.message}`)
    }
  }

  async onSvgUnlink(filePath) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    this.invalidateAssetDependents(filePath)
    this.context.imageGraph.removeFile(filePath)
    const distPath = resolve(this.context.paths.dist, relPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Image ----

  async onImageChange(filePath, event) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `image: ${relPath}`)
    try {
      await this.runTask('image', { files: [filePath] })
      this.invalidateAssetDependents(filePath, event)
      this.reload()
    } catch (error) {
      logger.error('watch', `Image processing failed: ${error.message}`)
    }
  }

  async onImageUnlink(filePath) {
    clearImageSizeCache()
    const { paths, config, cache, imageGraph } = this.context
    const relPath = relative(paths.src, filePath)

    const affected = imageGraph.getAffectedParents(filePath)
    imageGraph.removeFile(filePath)
    affected.forEach(file => cache.invalidatePageHtml(file))

    const optimization = config.build.imageOptimization
    const ext = extname(filePath)
    const newExt = optimization === 'avif' || optimization === 'webp' ? `.${optimization}` : ext
    const destRelPath = relPath.replace(new RegExp(`\\${ext}$`, 'i'), newExt)
    const distPath = resolve(paths.dist, destRelPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- Public ----

  async onPublicChange(filePath, event) {
    const relPath = relative(this.context.paths.public, filePath)
    logger.info(event, `public: ${relPath}`)

    // public 配下の画像も imageInfo から参照され得る（src に無ければ public を見る）
    if (this.isImageAsset(filePath)) {
      clearImageSizeCache()
      this.invalidateAssetDependents(filePath, event)
    }

    try {
      await this.runTask('copy', { files: [filePath] })
      this.reload()
    } catch (error) {
      logger.error('watch', `Copy failed: ${error.message}`)
    }
  }

  async onPublicUnlink(filePath) {
    const relPath = relative(this.context.paths.public, filePath)

    if (this.isImageAsset(filePath)) {
      clearImageSizeCache()
      this.invalidateAssetDependents(filePath)
      this.context.imageGraph.removeFile(filePath)
    }

    const distPath = resolve(this.context.paths.dist, relPath)
    await this.deleteDistFile(distPath, relPath)
  }

  // ---- 共通ヘルパー ----

  /**
   * アセット（画像・SVG）に依存するページのキャッシュを無効化する。
   * - imageGraph 経由（imageInfo で参照）: HTML キャッシュのみ無効化
   * - graph 経由（include でテンプレートに焼き込み）: テンプレートごと無効化
   * - add イベントで依存が見つからない場合、「参照されているがまだ存在しなかった
   *   アセットが後から追加された」可能性があるため、全ページ HTML を無効化する
   *   （コンパイルは伴わないためコストは実質ゼロ）
   */
  invalidateAssetDependents(filePath, event) {
    const { cache, graph, imageGraph } = this.context

    const renderAffected = imageGraph.getAffectedParents(filePath)
    renderAffected.forEach(file => cache.invalidatePageHtml(file))

    const templateAffected = graph.getAffectedParents(filePath)
    templateAffected.forEach(file => {
      cache.invalidatePugTemplate(file)
      cache.invalidatePageHtml(file)
    })

    if (event === 'add' && renderAffected.length === 0 && templateAffected.length === 0) {
      cache.clearPageHtml()
    }
  }

  /**
   * リロード通知。HTML はメモリ配信（リクエスト時ビルド）になり dist の書き込み完了を
   * 待つ必要がなくなったため即時に送る。
   *
   * kind 'html' は Pug 由来の変更で、クライアントは DOM 差分更新で反映する。
   * JS・画像・SVG・public の変更は HTML 以外のリソースを取り直す必要があるため
   * 'full'（フルリロード）にする。
   */
  reload(kind = 'full') {
    if (this.context.server) {
      this.context.server.reload(kind)
    }
  }

  async deleteDistFile(distPath, relPath, { withSourceMap = false } = {}) {
    try {
      await rm(distPath, { force: true })
      // ソースマップを置き去りにすると削除済みファイルの .map だけ配信され続ける
      if (withSourceMap) await rm(`${distPath}.map`, { force: true })
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
