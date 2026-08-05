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
