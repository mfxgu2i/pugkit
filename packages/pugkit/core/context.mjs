import { resolve, isAbsolute } from 'node:path'
import { CacheManager } from './cache.mjs'
import { DependencyGraph } from './graph.mjs'
import { createGlobPatterns } from '../config/index.mjs'

export class BuildContext {
  constructor(config, mode) {
    this.config = config
    this.mode = mode
    this.cache = new CacheManager(mode)
    this.graph = new DependencyGraph()
    this.sassGraph = new DependencyGraph()
    this.scriptGraph = new DependencyGraph()

    const outDir = config.outDir ?? 'dist'
    const resolvedOutDir = isAbsolute(outDir) ? outDir : resolve(config.root, outDir)

    this.paths = {
      root: config.root,
      src: resolve(config.root, 'src'),
      outDir: resolvedOutDir,
      dist: config.subdir ? resolve(resolvedOutDir, config.subdir) : resolvedOutDir,
      public: resolve(config.root, 'public')
    }

    this.patterns = createGlobPatterns(this.paths.src)
    this.server = null
    this.taskRegistry = null
  }

  async runTask(taskName, taskFn, options = {}) {
    await taskFn(this, options)
  }

  async runParallel(tasks) {
    await Promise.all(tasks.map(({ name, fn, options = {} }) => this.runTask(name, fn, options)))
  }

  async runSeries(tasks) {
    for (const { name, fn, options = {} } of tasks) {
      await this.runTask(name, fn, options)
    }
  }

  get isProduction() {
    return this.mode === 'production'
  }

  get isDevelopment() {
    return this.mode === 'development'
  }
}
