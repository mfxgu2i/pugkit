import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolvePugSource, createLazyPageBuilder } from '../../core/server.mjs'
import { CacheManager } from '../../core/cache.mjs'

describe('resolvePugSource', () => {
  let root
  let paths

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'pugkit-server-test-'))
    paths = { src: resolve(root, 'src') }

    await mkdir(resolve(root, 'src/blog'), { recursive: true })
    await mkdir(resolve(root, 'src/docs'), { recursive: true })
    await mkdir(resolve(root, 'src/_partials'), { recursive: true })
    await mkdir(resolve(root, 'src/_drafts'), { recursive: true })
    await writeFile(resolve(root, 'src/index.pug'), 'p index')
    await writeFile(resolve(root, 'src/about.pug'), 'p about')
    await writeFile(resolve(root, 'src/blog/index.pug'), 'p blog')
    await writeFile(resolve(root, 'src/blog.pug'), 'p blog-flat')
    await writeFile(resolve(root, 'src/docs/index.pug'), 'p docs')
    await writeFile(resolve(root, 'src/_partials/_header.pug'), 'header')
    await writeFile(resolve(root, 'src/_drafts/page.pug'), 'p draft')
    await writeFile(resolve(root, 'secret.pug'), 'p secret')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should resolve / to src/index.pug', () => {
    expect(resolvePugSource('/', paths)).toBe(resolve(paths.src, 'index.pug'))
  })

  it('should resolve /about.html to src/about.pug', () => {
    expect(resolvePugSource('/about.html', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should resolve extensionless /about to src/about.pug', () => {
    expect(resolvePugSource('/about', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should prefer flat .pug over index.pug for extensionless path (sirv-compatible order)', () => {
    expect(resolvePugSource('/blog', paths)).toBe(resolve(paths.src, 'blog.pug'))
    expect(resolvePugSource('/blog/', paths)).toBe(resolve(paths.src, 'blog.pug'))
  })

  it('should fall back to index.pug when no flat .pug exists', async () => {
    expect(resolvePugSource('/docs', paths)).toBe(resolve(paths.src, 'docs/index.pug'))
    expect(resolvePugSource('/docs/', paths)).toBe(resolve(paths.src, 'docs/index.pug'))
  })

  it('should resolve /blog/index.html to blog/index.pug', () => {
    expect(resolvePugSource('/blog/index.html', paths)).toBe(resolve(paths.src, 'blog/index.pug'))
  })

  it('should match .html case-insensitively (avoid stale dist fallback on case-insensitive FS)', () => {
    expect(resolvePugSource('/about.HTML', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should return null for missing pages', () => {
    expect(resolvePugSource('/nope.html', paths)).toBeNull()
    expect(resolvePugSource('/nope/', paths)).toBeNull()
  })

  it('should return null for non-html extensions', () => {
    expect(resolvePugSource('/css/style.css', paths)).toBeNull()
    expect(resolvePugSource('/img/a.png', paths)).toBeNull()
  })

  it('should not serve partials or underscore directories', () => {
    expect(resolvePugSource('/_partials/_header.html', paths)).toBeNull()
    expect(resolvePugSource('/_drafts/page.html', paths)).toBeNull()
    expect(resolvePugSource('/_drafts/page', paths)).toBeNull()
  })

  it('should not escape src (path traversal)', () => {
    expect(resolvePugSource('/../secret.html', paths)).toBeNull()
    expect(resolvePugSource('/blog/../../secret.html', paths)).toBeNull()
  })

  describe('with subdir', () => {
    const subdir = '/sub'

    it('should strip the subdir prefix', () => {
      expect(resolvePugSource('/sub/about.html', paths, subdir)).toBe(resolve(paths.src, 'about.pug'))
      expect(resolvePugSource('/sub/', paths, subdir)).toBe(resolve(paths.src, 'index.pug'))
      expect(resolvePugSource('/sub', paths, subdir)).toBe(resolve(paths.src, 'index.pug'))
    })

    it('should not resolve URLs without the subdir prefix', () => {
      expect(resolvePugSource('/about.html', paths, subdir)).toBeNull()
      expect(resolvePugSource('/', paths, subdir)).toBeNull()
    })

    it('should not match prefix across segment boundaries', () => {
      expect(resolvePugSource('/subfoo/about.html', paths, subdir)).toBeNull()
    })
  })
})

describe('createLazyPageBuilder', () => {
  function createDeferred() {
    let resolveFn, rejectFn
    const promise = new Promise((res, rej) => {
      resolveFn = res
      rejectFn = rej
    })
    return { promise, resolve: resolveFn, reject: rejectFn }
  }

  function createContext() {
    return { cache: new CacheManager('development') }
  }

  const FILE = '/src/index.pug'

  it('should serve from cache when present', async () => {
    const context = createContext()
    context.cache.setPageHtml(FILE, 'cached')
    let calls = 0
    const getPage = createLazyPageBuilder(context, async () => {
      calls++
      return 'built'
    })
    expect(await getPage(FILE)).toBe('cached')
    expect(calls).toBe(0)
  })

  it('should build on cache miss and cache the result', async () => {
    const context = createContext()
    let calls = 0
    const getPage = createLazyPageBuilder(context, async () => {
      calls++
      return 'built'
    })
    expect(await getPage(FILE)).toBe('built')
    expect(context.cache.getPageHtml(FILE)).toBe('built')
    expect(calls).toBe(1)
  })

  it('should dedupe concurrent requests for the same page', async () => {
    const context = createContext()
    const deferred = createDeferred()
    let calls = 0
    const getPage = createLazyPageBuilder(context, () => {
      calls++
      return deferred.promise
    })
    const p1 = getPage(FILE)
    const p2 = getPage(FILE)
    deferred.resolve('built')
    expect(await p1).toBe('built')
    expect(await p2).toBe('built')
    expect(calls).toBe(1)
  })

  it('should not cache errors and should retry on next request', async () => {
    const context = createContext()
    let calls = 0
    const getPage = createLazyPageBuilder(context, async () => {
      calls++
      if (calls === 1) throw new Error('boom')
      return 'recovered'
    })
    await expect(getPage(FILE)).rejects.toThrow('boom')
    expect(context.cache.getPageHtml(FILE)).toBeUndefined()
    expect(await getPage(FILE)).toBe('recovered')
    expect(calls).toBe(2)
  })

  it('should not store a build result that was invalidated mid-build', async () => {
    const context = createContext()
    const deferred = createDeferred()
    const getPage = createLazyPageBuilder(context, () => deferred.promise)

    const pending = getPage(FILE)
    // ビルド中にソース変更 → watcher が無効化
    context.cache.invalidatePageHtml(FILE)
    deferred.resolve('stale')

    expect(await pending).toBe('stale') // このリクエスト自体には返す
    expect(context.cache.getPageHtml(FILE)).toBeUndefined() // キャッシュには入らない
  })

  it('should not join a stale in-flight build after invalidation', async () => {
    const context = createContext()
    const first = createDeferred()
    const second = createDeferred()
    let calls = 0
    const getPage = createLazyPageBuilder(context, () => {
      calls++
      return calls === 1 ? first.promise : second.promise
    })

    const p1 = getPage(FILE)
    context.cache.invalidatePageHtml(FILE)

    // 無効化後の新リクエストは古い in-flight に相乗りせず新規ビルドを開始する
    const p2 = getPage(FILE)
    expect(calls).toBe(2)

    first.resolve('stale')
    second.resolve('fresh')

    expect(await p1).toBe('stale')
    expect(await p2).toBe('fresh')
    expect(context.cache.getPageHtml(FILE)).toBe('fresh')
  })
})
