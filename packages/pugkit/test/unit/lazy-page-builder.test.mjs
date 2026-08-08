import { describe, expect, it } from 'vitest'
import { createLazyPageBuilder } from '../../core/dev/lazy-builder.mjs'
import { CacheManager } from '../../core/cache.mjs'

/**
 * リクエスト時ビルドの並行性。
 * ビルド関数を注入できるため、タイマーを使わず決定論的に検証できる。
 */
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
