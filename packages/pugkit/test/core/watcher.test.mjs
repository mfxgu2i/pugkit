import { describe, expect, it } from 'vitest'
import { FileWatcher } from '../../core/watcher.mjs'
import { CacheManager } from '../../core/cache.mjs'
import { DependencyGraph } from '../../core/graph.mjs'

const SRC = '/proj/src'

function createContext() {
  return {
    paths: { src: SRC, public: '/proj/public', dist: '/proj/dist' },
    config: { build: { imageOptimization: 'webp' } },
    cache: new CacheManager('development'),
    graph: new DependencyGraph(),
    imageGraph: new DependencyGraph(),
    sassGraph: new DependencyGraph(),
    scriptGraph: new DependencyGraph(),
    taskRegistry: {},
    server: null,
    isDevelopment: true,
    isProduction: false
  }
}

function cachePage(context, page) {
  context.cache.setPugTemplate(page, () => 'html')
  context.cache.setPageHtml(page, '<html></html>')
}

describe('FileWatcher pug invalidation', () => {
  const page = `${SRC}/index.pug`
  const partial = `${SRC}/_partials/_layout.pug`

  it('onPugChange(page) should invalidate the page itself', () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)

    watcher.onPugChange(page)

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('onPugChange(partial) should invalidate affected parent pages', () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)
    context.graph.addDependency(page, partial)

    watcher.onPugChange(partial)

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('onPugChange(partial) should not touch unrelated pages', () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    const other = `${SRC}/other.pug`
    cachePage(context, page)
    cachePage(context, other)
    context.graph.addDependency(page, partial)

    watcher.onPugChange(partial)

    expect(context.cache.getPageHtml(other)).toBe('<html></html>')
  })

  it('onPugChange should invalidate transitively affected pages (partial in partial)', () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    const inner = `${SRC}/_partials/_button.pug`
    cachePage(context, page)
    context.graph.addDependency(page, partial)
    context.graph.addDependency(partial, inner)

    watcher.onPugChange(inner)

    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('onPugUnlink(partial) should invalidate parents before clearing graph edges', () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)
    context.graph.addDependency(page, partial)

    watcher.onPugUnlink(partial)

    // 親ページが無効化されている（clearDependencies 後だと逆引きが消えて取れない）
    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.graph.getAffectedParents(partial)).toEqual([])
  })
})

describe('FileWatcher image invalidation', () => {
  const page = `${SRC}/index.pug`
  const image = `${SRC}/assets/hero.jpg`

  it('onImageChange should invalidate only dependent pages and keep templates', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    const other = `${SRC}/other.pug`
    cachePage(context, page)
    cachePage(context, other)
    context.imageGraph.addDependency(page, image)

    await watcher.onImageChange(image, 'change')

    // 参照ページ: HTML のみ無効化（テンプレートは温存 = 再レンダーだけで済む）
    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.cache.getPugTemplate(page)).toBeDefined()
    // 非参照ページ: 温存
    expect(context.cache.getPageHtml(other)).toBe('<html></html>')
  })

  it('onImageChange(change) with no dependents should be a no-op for caches', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)

    await watcher.onImageChange(image, 'change')

    expect(context.cache.getPageHtml(page)).toBe('<html></html>')
  })

  it('onImageChange(add) with no dependents should clear all page html (missing-image fallback)', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)

    // ページが「存在しない画像」を参照 → imageGraph にエッジが無い状態で画像が追加されたケース
    await watcher.onImageChange(image, 'add')

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    // テンプレートは温存（画像はテンプレートに焼き込まれない）
    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })

  it('onImageUnlink should invalidate dependent pages', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)
    context.imageGraph.addDependency(page, image)

    await watcher.onImageUnlink(image)

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.imageGraph.getAffectedParents(image)).toEqual([])
  })
})

describe('FileWatcher svg invalidation', () => {
  const page = `${SRC}/index.pug`
  const svg = `${SRC}/assets/logo.svg`

  it('onSvgChange should invalidate template for inline-included svg (graph dependency)', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)
    // include /assets/logo.svg はテンプレートに焼き込まれるため graph 側に記録される
    context.graph.addDependency(page, svg)

    await watcher.onSvgChange(svg, 'change')

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('onSvgChange should invalidate html only for imageSize-referenced svg (imageGraph)', async () => {
    const context = createContext()
    const watcher = new FileWatcher(context)
    cachePage(context, page)
    context.imageGraph.addDependency(page, svg)

    await watcher.onSvgChange(svg, 'change')

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })
})
