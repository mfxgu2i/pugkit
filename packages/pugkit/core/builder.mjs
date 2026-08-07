import { BuildContext } from './context.mjs'
import { logger } from '../utils/logger.mjs'
import { cleanDir } from '../utils/file.mjs'

// ビルドの順序。同じ段のタスクは並列に走る。
// Pug は Sass/Script の出力を参照するため中段に置く
const BUILD_PHASES = [
  ['sass', 'script', 'sprite'],
  ['pug'],
  ['image', 'svg', 'copy']
]

/**
 * メインビルダー
 */
export class Builder {
  constructor(config, mode = 'development') {
    this.context = new BuildContext(config, mode)
    this.tasks = {}
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

    if (context.config.build.clean) await this.clean()
    else logger.info('build', 'Skipping clean (clean: false)')

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
    if (this.tasks.watch) await this.tasks.watch(this.context, { runTask: this.runTask.bind(this) })
    if (this.tasks.server) await this.tasks.server(this.context)
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
    const distPath = this.context.paths.dist
    logger.info('clean', 'Cleaning dist directory')

    await cleanDir(distPath)

    this.context.cache.clear()
    this.context.graph.clear()

    logger.success('clean', 'Completed')
  }
}
