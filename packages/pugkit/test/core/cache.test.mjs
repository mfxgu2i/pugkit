import { describe, expect, it } from 'vitest'
import { CacheManager } from '../../core/cache.mjs'

describe('CacheManager pageHtml cache', () => {
  it('should store and retrieve page html in development', () => {
    const cache = new CacheManager('development')
    cache.setPageHtml('/src/index.pug', '<html>a</html>')
    expect(cache.getPageHtml('/src/index.pug')).toBe('<html>a</html>')
  })

  it('should not store page html in production', () => {
    const cache = new CacheManager('production')
    const stored = cache.setPageHtml('/src/index.pug', '<html>a</html>')
    expect(stored).toBe(false)
    expect(cache.getPageHtml('/src/index.pug')).toBeUndefined()
  })

  it('should invalidate a single page', () => {
    const cache = new CacheManager('development')
    cache.setPageHtml('/src/a.pug', 'a')
    cache.setPageHtml('/src/b.pug', 'b')
    cache.invalidatePageHtml('/src/a.pug')
    expect(cache.getPageHtml('/src/a.pug')).toBeUndefined()
    expect(cache.getPageHtml('/src/b.pug')).toBe('b')
  })

  it('should clear all pages', () => {
    const cache = new CacheManager('development')
    cache.setPageHtml('/src/a.pug', 'a')
    cache.setPageHtml('/src/b.pug', 'b')
    cache.clearPageHtml()
    expect(cache.getPageHtml('/src/a.pug')).toBeUndefined()
    expect(cache.getPageHtml('/src/b.pug')).toBeUndefined()
  })

  describe('epoch guard', () => {
    it('should advance epoch on invalidation', () => {
      const cache = new CacheManager('development')
      const before = cache.getPageEpoch('/src/a.pug')
      cache.invalidatePageHtml('/src/a.pug')
      expect(cache.getPageEpoch('/src/a.pug')).toBe(before + 1)
    })

    it('should advance epoch of all pages on clearPageHtml', () => {
      const cache = new CacheManager('development')
      const a = cache.getPageEpoch('/src/a.pug')
      const b = cache.getPageEpoch('/src/b.pug')
      cache.clearPageHtml()
      expect(cache.getPageEpoch('/src/a.pug')).toBe(a + 1)
      expect(cache.getPageEpoch('/src/b.pug')).toBe(b + 1)
    })

    it('should reject setPageHtml when invalidated after build start', () => {
      const cache = new CacheManager('development')
      const epoch = cache.getPageEpoch('/src/a.pug')
      cache.invalidatePageHtml('/src/a.pug')
      const stored = cache.setPageHtml('/src/a.pug', 'stale', epoch)
      expect(stored).toBe(false)
      expect(cache.getPageHtml('/src/a.pug')).toBeUndefined()
    })

    it('should accept setPageHtml when epoch matches', () => {
      const cache = new CacheManager('development')
      const epoch = cache.getPageEpoch('/src/a.pug')
      const stored = cache.setPageHtml('/src/a.pug', 'fresh', epoch)
      expect(stored).toBe(true)
      expect(cache.getPageHtml('/src/a.pug')).toBe('fresh')
    })

    it('should reject setPugTemplate when invalidated after build start', () => {
      const cache = new CacheManager('development')
      const epoch = cache.getPageEpoch('/src/a.pug')
      cache.invalidatePageHtml('/src/a.pug')
      cache.setPugTemplate('/src/a.pug', () => 'stale', epoch)
      expect(cache.getPugTemplate('/src/a.pug')).toBeUndefined()
    })

    it('should accept setPugTemplate without epoch (production path compatibility)', () => {
      const cache = new CacheManager('development')
      const fn = () => 'x'
      cache.setPugTemplate('/src/a.pug', fn)
      expect(cache.getPugTemplate('/src/a.pug')).toBe(fn)
    })
  })

  describe('LRU size cap', () => {
    // 1文字 = 2バイト換算なので、limit 200 は「100文字ぶん」
    const limit = 200
    const page = n => 'x'.repeat(n)

    function createCappedCache() {
      return new CacheManager('development', { pageHtmlCacheLimit: limit })
    }

    it('should keep pages while under the limit', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/a.pug', page(40))
      cache.setPageHtml('/b.pug', page(40))
      expect(cache.getPageHtml('/a.pug')).toBeDefined()
      expect(cache.getPageHtml('/b.pug')).toBeDefined()
    })

    it('should evict the oldest page when the limit is exceeded', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/a.pug', page(60))
      cache.setPageHtml('/b.pug', page(60))
      // ここで 180 文字 = 360 バイト > limit なので古い順に落ちる
      expect(cache.getPageHtml('/a.pug')).toBeUndefined()
      expect(cache.getPageHtml('/b.pug')).toBeDefined()
    })

    it('should never evict the page just stored', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/huge.pug', page(1000))
      expect(cache.getPageHtml('/huge.pug')).toBeDefined()
    })

    it('should evict least-recently-used, not least-recently-written', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/a.pug', page(45))
      cache.setPageHtml('/b.pug', page(45))
      // /a.pug を参照して「最近使った」側に回す
      cache.getPageHtml('/a.pug')
      cache.setPageHtml('/c.pug', page(45))

      expect(cache.getPageHtml('/b.pug')).toBeUndefined()
      expect(cache.getPageHtml('/a.pug')).toBeDefined()
      expect(cache.getPageHtml('/c.pug')).toBeDefined()
    })

    it('should not advance epochs when evicting (eviction is not invalidation)', () => {
      const cache = createCappedCache()
      const epochBefore = cache.getPageEpoch('/a.pug')
      cache.setPageHtml('/a.pug', page(60))
      cache.setPageHtml('/b.pug', page(60))

      expect(cache.getPageHtml('/a.pug')).toBeUndefined()
      expect(cache.getPageEpoch('/a.pug')).toBe(epochBefore)
    })

    it('should let an in-flight build store its result after its page was evicted', () => {
      const cache = createCappedCache()
      const epoch = cache.getPageEpoch('/a.pug')
      cache.setPageHtml('/a.pug', page(60))
      cache.setPageHtml('/b.pug', page(60)) // /a.pug が落ちる

      expect(cache.setPageHtml('/a.pug', page(10), epoch)).toBe(true)
      expect(cache.getPageHtml('/a.pug')).toBeDefined()
    })

    it('should track size correctly on overwrite and invalidation', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/a.pug', page(50))
      cache.setPageHtml('/a.pug', page(20))
      expect(cache.pageHtmlBytes).toBe(40)

      cache.invalidatePageHtml('/a.pug')
      expect(cache.pageHtmlBytes).toBe(0)
    })

    it('should reset the size counter on clearPageHtml and clear', () => {
      const cache = createCappedCache()
      cache.setPageHtml('/a.pug', page(50))
      cache.clearPageHtml()
      expect(cache.pageHtmlBytes).toBe(0)

      cache.setPageHtml('/b.pug', page(50))
      cache.clear()
      expect(cache.pageHtmlBytes).toBe(0)
    })
  })

  it('clear() should strictly advance all epochs (in-flight builds must stay invalid)', () => {
    const cache = new CacheManager('development')
    cache.invalidatePageHtml('/src/a.pug')
    cache.invalidatePageHtml('/src/a.pug')
    cache.invalidatePageHtml('/src/b.pug')
    const epochA = cache.getPageEpoch('/src/a.pug')
    const epochB = cache.getPageEpoch('/src/b.pug')
    cache.clear()
    expect(cache.getPageEpoch('/src/a.pug')).toBeGreaterThan(epochA)
    expect(cache.getPageEpoch('/src/b.pug')).toBeGreaterThan(epochB)
    expect(cache.getPageHtml('/src/a.pug')).toBeUndefined()
  })
})
