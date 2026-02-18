import { loadConfig } from './config/index.mjs'
import { Builder } from './core/builder.mjs'
import pugTask from './tasks/pug.mjs'
import sassTask from './tasks/sass.mjs'
import scriptTask from './tasks/script.mjs'
import copyTask from './tasks/copy.mjs'
import imageTask from './tasks/image.mjs'
import svgTask from './tasks/svg.mjs'
import spriteTask from './tasks/svg-sprite.mjs'
import serverTask from './core/server.mjs'
import watcherTask from './core/watcher.mjs'

export async function createBuilder(root = process.cwd(), mode = 'development') {
  const config = await loadConfig(root)
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

  builder.context.taskRegistry = {
    pug: pugTask,
    sass: sassTask,
    script: scriptTask,
    image: imageTask,
    svg: svgTask,
    copy: copyTask
  }

  return builder
}

export async function build(root = process.cwd()) {
  const builder = await createBuilder(root, 'production')
  await builder.build()
}

export async function watch(root = process.cwd()) {
  const builder = await createBuilder(root, 'development')
  await builder.watch()
}

export async function runTask(taskName, root = process.cwd()) {
  const builder = await createBuilder(root, 'production')
  await builder.runTask(taskName)
}

export { Builder, loadConfig }
export { BuildContext } from './core/context.mjs'
export { CacheManager } from './core/cache.mjs'
export { DependencyGraph } from './core/graph.mjs'
export { defineConfig } from './config/index.mjs'
