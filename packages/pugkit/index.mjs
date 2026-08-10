import { existsSync } from 'node:fs'
import { loadConfig } from './config/index.mjs'
import { Builder } from './core/builder.mjs'
import { BuildContext } from './core/context.mjs'
import { runChecks } from './core/check/index.mjs'
import pugTask from './tasks/pug.mjs'
import sassTask from './tasks/sass.mjs'
import scriptTask from './tasks/script.mjs'
import copyTask from './tasks/copy.mjs'
import imageTask from './tasks/image.mjs'
import svgTask from './tasks/svg.mjs'
import spriteTask from './tasks/svg-sprite.mjs'
import serverTask from './core/server.mjs'
import watcherTask from './core/watcher.mjs'

export async function createBuilder(root = process.cwd(), mode = 'development', inlineConfig = {}) {
  const config = await loadConfig(root, inlineConfig)
  const builder = new Builder(config, mode)

  builder.registerTasks({
    pug: pugTask,
    sass: sassTask,
    script: scriptTask,
    image: imageTask,
    svg: svgTask,
    sprite: spriteTask,
    copy: copyTask,
    server: serverTask,
    watch: watcherTask
  })

  return builder
}

export async function build(root = process.cwd()) {
  const builder = await createBuilder(root, 'production')
  await builder.build()
}

/**
 * build の成果物を検査する。ビルドはしない。
 *
 * 検査を build から分けているのは、過去の負債でビルドが止まると、
 * 今の更新を出すために関係のない箇所まで直す羽目になるため。
 * 最新を見たいときは `pugkit build && pugkit check` と並べる。
 *
 * 終了コードは決めない。プロセスを終わらせる責任を公開 API に持たせると、
 * テストから呼んだ瞬間にテストランナーごと落ちる
 *
 * @param items 検査項目の id。空なら全部
 * @returns {Promise<{ findings: object[], notices: string[] }>}
 */
export async function check(root = process.cwd(), items = []) {
  const config = await loadConfig(root)
  const context = new BuildContext(config, 'production')

  if (!existsSync(context.paths.outputRoot)) {
    throw new Error(
      `出力先が見つかりません: ${context.paths.outputRoot}\n先に pugkit build を実行してください。check はビルドしません`
    )
  }

  return runChecks(context, items)
}

export { Builder, loadConfig }
export { BuildContext } from './core/context.mjs'
export { CacheManager } from './core/cache.mjs'
export { DependencyGraph } from './core/graph.mjs'
export { defineConfig } from './config/index.mjs'
