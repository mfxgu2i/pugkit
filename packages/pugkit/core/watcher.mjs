import chokidar from 'chokidar'
import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { relative, basename, dirname, sep } from 'node:path'
import { logger } from '../utils/logger.mjs'
import { isConvertibleImage, isMeasurableImage } from '../utils/image-formats.mjs'
import { clearImageSizeCache } from '../transform/image-size.mjs'
import { spriteOutputPath } from '../tasks/svg-sprite.mjs'
import { svgOutputPath } from '../tasks/svg.mjs'
import { imageOutputPaths } from '../tasks/image.mjs'
import { sassOutputPath } from '../tasks/sass.mjs'
import { scriptOutputPath } from '../tasks/script.mjs'
import { publicOutputPath } from '../tasks/copy.mjs'
import { prepareDevSession } from './dev/startup.mjs'

// 自分のハンドラで graph（Pug への焼き込み）を見る種別。二重に無効化しない
const HANDLES_EMBEDDING = new Set(['svg', 'image', 'public'])

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

    /**
     * 種別ごとの反応。change と add は同じ扱いで、イベント名だけ渡す
     * （画像の add は「参照先が後から置かれた」ケースの判定に使う）。
     *
     * 1回だけ組み立てる。イベントごとに作ると、保存のたびに全種別ぶんの
     * クロージャを捨てるために作ることになる
     */
    this.handlers = {
      public: { change: (f, e) => this.onPublicChange(f, e), unlink: f => this.onPublicUnlink(f) },
      pug: { change: f => this.onPugChange(f), unlink: f => this.onPugUnlink(f) },
      sass: { change: f => this.onSassChange(f), unlink: f => this.onSassUnlink(f) },
      script: { change: f => this.onScriptChange(f), unlink: f => this.onScriptUnlink(f) },
      // スプライトは icons ディレクトリ全体から1ファイルを作るので削除も再生成でよい
      sprite: { change: (f, e) => this.onSpriteChange(f, e), unlink: (f, e) => this.onSpriteChange(f, e) },
      svg: { change: (f, e) => this.onSvgChange(f, e), unlink: f => this.onSvgUnlink(f) },
      image: { change: (f, e) => this.onImageChange(f, e), unlink: f => this.onImageUnlink(f) }
    }
  }

  async start() {
    const { paths } = this.context

    // 起動シーケンス（ポート確認・キャッシュ作り直し・衝突検査・初期ビルド）は
    // 順序そのものが仕様なので core/dev/startup.mjs にまとめてある。
    // ここが持つのは監視の結線だけ
    await prepareDevSession(this.context, this.runTask)

    this.watcher = chokidar
      .watch([paths.src, paths.public], {
        ignoreInitial: true,
        // 除外は絶対パス全体に当たる。「.」始まりを一律に外すと、プロジェクトを
        // 「.」始まりのディレクトリに置いた場合に監視が丸ごと効かなくなる。
        // 拾いすぎた分は classify が対象外（null）に落とすので害はない
        ignored: [/node_modules/, /\.git/],
        persistent: true,
        // 書き込み安定待ちは検知レイテンシに直結する。テキストファイル中心の
        // ソースでは 50ms の安定確認で十分（旧: 100ms 安定 + 100ms ポーリングで
        // 実効 100〜200ms）。途中書き込みを読んでもエラーページ → 次の保存で
        // 自動復帰する構造のためリスクは限定的
        awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 }
      })
      .on('change', filePath => this.handle('change', filePath))
      .on('add', filePath => this.handle('add', filePath))
      .on('unlink', filePath => this.handle('unlink', filePath))

    logger.info('watch', 'File watching started')
  }

  /**
   * 変更されたファイルの種別を決める。
   *
   * 判定の順序そのものが仕様。特に「_」始まりの除外は、
   * スプライト対象の判定より後・通常アセットより前でなければならない。
   * 対象外なら null。
   */
  classify(filePath) {
    if (this.isPublic(filePath)) return 'public'
    if (filePath.endsWith('.pug')) return 'pug'
    if (filePath.endsWith('.scss')) return 'sass'
    if (this.isScript(filePath)) return 'script'
    if (filePath.endsWith('.svg') && this.isIcons(filePath)) return 'sprite'
    if (this.isHiddenAsset(filePath)) return null
    if (filePath.endsWith('.svg')) return 'svg'
    if (isConvertibleImage(filePath)) return 'image'
    return null
  }

  /**
   * 変更イベントを種別ごとのハンドラへ振り分ける。
   */
  handle(event, filePath) {
    const kind = this.classify(filePath)

    // include は .pug 以外も受け付け、中身をテンプレートに焼き込む
    // （クリティカル CSS のインライン化、インライン JS、データファイルなど）。
    // アセットとしての種別が何であっても、焼き込まれている分の無効化が要る。
    // Pug 自身と、アセット経由で graph を見る種別は各ハンドラが担当する
    const embedded = kind === 'pug' || HANDLES_EMBEDDING.has(kind) ? [] : this.invalidateEmbedded(filePath)

    if (!kind) {
      if (embedded.length > 0) this.reload('html')
      return
    }

    const handled = this.handlers[kind][event === 'unlink' ? 'unlink' : 'change'](filePath, event)

    // Sass は CSS を差し替えるだけでリロードを通知しない。
    // 焼き込まれている分はそれでは古いままなので、別に知らせる
    if (kind !== 'sass' || embedded.length === 0) return handled
    return Promise.resolve(handled).then(() => this.reload('html'))
  }

  /**
   * include で Pug に焼き込まれているファイルの、親ページを無効化する。
   * 依存は graph に登録済みなので、拡張子ではなく依存関係で判断する。
   */
  invalidateEmbedded(filePath) {
    const { cache, graph } = this.context
    const parents = graph.getAffectedParents(filePath)

    for (const file of parents) {
      cache.invalidatePugTemplate(file)
      cache.invalidatePageHtml(file)
    }

    return parents
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
      await this.runTask('sass', { changed: filePath })
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
    const outputPath = sassOutputPath(relPath, paths)
    await this.deleteOutputFile(outputPath, relPath, { withSourceMap: true })
  }

  // ---- Script ----

  async onScriptChange(filePath) {
    const relPath = relative(this.context.paths.src, filePath)
    logger.info('change', `script: ${relPath}`)
    try {
      await this.runTask('script', { changed: filePath })
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
    const outputPath = scriptOutputPath(relPath, paths)
    await this.deleteOutputFile(outputPath, relPath, { withSourceMap: true })
  }

  // ---- SVG ----

  async onSvgChange(filePath, event) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `svg: ${relPath}`)
    try {
      await this.runTask('svg', { changed: filePath })
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
      if (event === 'unlink') await this.removeOrphanedSprite(filePath)
      // <use href> の参照先が変わるので取り直しが必要
      this.reload('full')
    } catch (error) {
      logger.error('watch', `Sprite generation failed: ${error.message}`)
    }
  }

  /**
   * icons ディレクトリごと消えたときのスプライトの後始末。
   * ディレクトリが残っていればタスクの再生成が処理するが、消えていると
   * glob から見えないので、消えたアイコンのパスから出力先を辿る
   */
  async removeOrphanedSprite(iconFile) {
    const { paths } = this.context
    const iconDir = dirname(iconFile)
    if (existsSync(iconDir)) return

    await rm(spriteOutputPath(relative(paths.src, iconDir), paths), { force: true })
  }

  async onSvgUnlink(filePath) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    this.invalidateAssetDependents(filePath)
    this.context.imageGraph.removeFile(filePath)
    await this.deleteOutputFile(svgOutputPath(relPath, this.context.paths), relPath)
  }

  // ---- Image ----

  async onImageChange(filePath, event) {
    clearImageSizeCache()
    const relPath = relative(this.context.paths.src, filePath)
    logger.info(event, `image: ${relPath}`)
    try {
      await this.runTask('image', { changed: filePath })
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

    // 1 ソースが複数の密度を生むので全部消す。
    // 出力先が衝突する構成はビルドが中止されるため、ここに来る出力は必ず自分が作ったもの
    const outputs = imageOutputPaths(relPath, config, paths)

    await Promise.all(outputs.map(out => rm(out.absolute, { force: true })))
    logger.info('unlink', relPath)
    this.reload()
  }

  // ---- Public ----

  async onPublicChange(filePath, event) {
    const relPath = relative(this.context.paths.public, filePath)
    logger.info(event, `public: ${relPath}`)

    // public 配下の画像も imageInfo から参照され得る（src に無ければ public を見る）
    if (isMeasurableImage(filePath)) {
      clearImageSizeCache()
      this.invalidateAssetDependents(filePath, event)
    }

    try {
      await this.runTask('copy', { changed: filePath })
      this.reload()
    } catch (error) {
      logger.error('watch', `Copy failed: ${error.message}`)
    }
  }

  async onPublicUnlink(filePath) {
    const relPath = relative(this.context.paths.public, filePath)

    if (isMeasurableImage(filePath)) {
      clearImageSizeCache()
      this.invalidateAssetDependents(filePath)
      this.context.imageGraph.removeFile(filePath)
    }

    const outputPath = publicOutputPath(relPath, this.context.paths)
    await this.deleteOutputFile(outputPath, relPath)
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

  async deleteOutputFile(outputPath, relPath, { withSourceMap = false } = {}) {
    try {
      await rm(outputPath, { force: true })
      // ソースマップを置き去りにすると削除済みファイルの .map だけ配信され続ける
      if (withSourceMap) await rm(`${outputPath}.map`, { force: true })
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
