import { loadConfig } from './config/index.mjs'
import { Builder } from './core/builder.mjs'
import pugTask from './tasks/pug.mjs'
import sassTask, { disposeDevCompiler } from './tasks/sass.mjs'
import scriptTask, { disposeDevContext } from './tasks/script.mjs'
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
    // Sass と esbuild は dev で常駐プロセスを持つので、止め方も一緒に渡す
    sass: { run: sassTask, dispose: disposeDevCompiler },
    script: { run: scriptTask, dispose: disposeDevContext },
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

export { Builder, loadConfig }
export { BuildContext } from './core/context.mjs'
export { CacheManager } from './core/cache.mjs'
export { DependencyGraph } from './core/graph.mjs'
export { defineConfig } from './config/index.mjs'
