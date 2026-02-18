import { BuildContext } from './context.mjs'
import { logger } from '../utils/logger.mjs'
import { cleanDir } from '../utils/file.mjs'

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

    try {
      // 1. クリーンアップ
      await this.clean()

      // 2. 並列ビルド（軽量タスク + スプライト）
      const parallelTasks = []

      if (this.tasks.sass) {
        parallelTasks.push({ name: 'sass', fn: this.tasks.sass })
      }
      if (this.tasks.script) {
        parallelTasks.push({ name: 'script', fn: this.tasks.script })
      }
      if (this.tasks.sprite) {
        parallelTasks.push({ name: 'sprite', fn: this.tasks.sprite })
      }

      if (parallelTasks.length > 0) {
        await context.runParallel(parallelTasks)
      }

      // 3. Pug（Sass/Scriptの出力を参照するため後）
      if (this.tasks.pug) {
        await context.runTask('pug', this.tasks.pug)
      }

      // 4. 最終処理（並列）
      const finalTasks = []

      if (this.tasks.image) {
        finalTasks.push({ name: 'image', fn: this.tasks.image })
      }
      if (this.tasks.svg) {
        finalTasks.push({ name: 'svg', fn: this.tasks.svg })
      }
      if (this.tasks.copy) {
        finalTasks.push({ name: 'copy', fn: this.tasks.copy })
      }

      if (finalTasks.length > 0) {
        await context.runParallel(finalTasks)
      }

      const elapsed = Date.now() - startTime
      logger.success('build', `Completed in ${elapsed}ms`)
    } catch (error) {
      logger.error('build', error.message)
      throw error
    }
  }

  /**
   * 監視モード（開発）
   */
  async watch() {
    const { context } = this

    try {
      // ファイル監視開始
      if (this.tasks.watch) {
        await context.runTask('watch', this.tasks.watch)
      }

      // 開発サーバー起動
      if (this.tasks.server) {
        await context.runTask('server', this.tasks.server)
      }
    } catch (error) {
      logger.error('watch', error.message)
      throw error
    }
  }

  /**
   * 個別タスク実行
   */
  async runTask(taskName, options = {}) {
    const task = this.tasks[taskName]

    if (!task) {
      throw new Error(`Task not found: ${taskName}`)
    }

    await this.context.runTask(taskName, task, options)
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
