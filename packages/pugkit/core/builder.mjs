import { BuildContext } from './context.mjs'
import { logger } from '../utils/logger.mjs'
import { cleanDir } from '../utils/file.mjs'
import { assertUniqueOutputs } from './output-conflicts.mjs'

// ビルドの順序。同じ段のタスクは並列に走る。
// Pug は Sass/Script の出力を参照するため中段に置く
const BUILD_PHASES = [['sass', 'script', 'sprite'], ['pug'], ['image', 'svg', 'copy']]

/**
 * メインビルダー
 */
export class Builder {
  constructor(config, mode = 'development') {
    this.context = new BuildContext(config, mode)
    this.tasks = {}
    // watch() で作られる。close() で止めるために保持する
    this.watcher = null
  }

  /**
   * タスクを登録
   */
  registerTask(name, fn) {
    this.tasks[name] = fn
  }

  /**
   * 複数タスクを登録
   */
  registerTasks(tasks) {
    Object.entries(tasks).forEach(([name, fn]) => {
      this.registerTask(name, fn)
    })
  }

  /**
   * 本番ビルド
   */
  async build() {
    const { context } = this
    const startTime = Date.now()

    logger.info('build', `Building in ${context.mode} mode`)

    // 出力先が衝突していると、どちらが残るかが決まらない。
    // 消す前に確かめる（中止するなら、前回の成果物は残したままにする）
    await assertUniqueOutputs(context)

    await this.clean()

    for (const phase of BUILD_PHASES) {
      const tasks = phase.map(name => this.tasks[name]).filter(Boolean)
      if (tasks.length > 0) await Promise.all(tasks.map(task => task(context)))
    }

    logger.success('build', `Completed in ${Date.now() - startTime}ms`)
  }

  /**
   * 監視モード（開発）
   */
  async watch() {
    // 監視の開始が先。サーバーはその後に待ち受けを始める
    if (this.tasks.watch) this.watcher = await this.tasks.watch(this.context, { runTask: this.runTask.bind(this) })
    if (this.tasks.server) await this.tasks.server(this.context)
  }

  /**
   * dev を止めて、抱えている常駐プロセスも終わらせる。
   *
   * 常駐プロセス（Sass / esbuild）は context.resources が持つので、core は
   * 「どのタスクが何を抱えているか」を知らずに捨てられる。
   * リソースはセッション単位なので、同一プロセスで動く別のビルダーは巻き込まない
   */
  async close() {
    await this.watcher?.stop()
    this.context.server?.close()

    await this.context.resources.disposeAll()
  }

  /**
   * 個別タスク実行
   */
  async runTask(taskName, options = {}) {
    const task = this.tasks[taskName]

    if (!task) {
      throw new Error(
        `タスク "${taskName}" は登録されていません。利用できるタスク: ${Object.keys(this.tasks).join(', ')}`
      )
    }

    await task(this.context, options)
  }

  /**
   * クリーンアップ
   */
  async clean() {
    // subdir の中だけでなく outDir 全体を作り直す。
    // subdir を変更したときに前の階層が残ると、src に無いページが本番に生き続ける
    logger.info('clean', 'Cleaning output directory')

    await cleanDir(this.context.paths.outputRoot)

    // 出力を消したら、それを前提にしていた状態も一緒に捨てる
    this.context.cache.clear()
    this.context.imageWidths.clear()
    for (const graph of [
      this.context.graph,
      this.context.sassGraph,
      this.context.scriptGraph,
      this.context.imageGraph
    ]) {
      graph.clear()
    }

    logger.success('clean', 'Completed')
  }
}
