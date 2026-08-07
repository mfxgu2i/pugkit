import { describe, expect, it } from 'vitest'
import { formatBytes, formatRatio, getCurrentFormatInfo, parseThreshold } from '../../cli/bench.mjs'

/**
 * pugkit bench の値解釈。
 * ここが間違うと「この quality で足りる」という助言そのものが誤りになり、
 * 利用者が本番の画像設定を誤って決めてしまう。
 */
describe('parseThreshold', () => {
  it.each([
    ['400KB', 409_600],
    ['400kb', 409_600],
    ['400 KB', 409_600],
    ['  400kb  ', 409_600],
    ['1.5MB', 1_572_864],
    ['0.5MB', 524_288],
    ['400B', 400],
    ['102400', 102_400],
    ['.5KB', 512]
  ])('%s -> %i バイト', (input, expected) => {
    expect(parseThreshold(input)).toBe(expected)
  })

  it('数値はそのまま使う', () => {
    expect(parseThreshold(400_000)).toBe(400_000)
  })

  it.each([['400GB'], ['400KiB'], [''], ['   '], ['abc'], ['-1KB'], ['KB'], ['400 MB extra'], ['1.2.3']])(
    '解釈できない %s は原文つきで拒否する',
    input => {
      expect(() => parseThreshold(input)).toThrow(/Invalid threshold value/)
    }
  )
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1_048_576, '1.00 MB'],
    [1_572_864, '1.50 MB']
  ])('%i -> %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected)
  })
})

describe('formatRatio', () => {
  it('圧縮できた分をマイナスで表す', () => {
    expect(formatRatio(100, 50)).toBe('-50%')
    expect(formatRatio(100, 0)).toBe('-100%')
  })

  it('圧縮後の方が大きい場合は増加として表す', () => {
    // 記号を前置きすると "--50%" のような表示になってしまう
    expect(formatRatio(100, 150)).toBe('+50%')
  })
})

describe('getCurrentFormatInfo', () => {
  const config = quality => ({
    build: {
      imageOptimization: quality.mode,
      imageOptions: { webp: { quality: 80 }, avif: { quality: 70 }, jpeg: { quality: 75 }, png: { quality: 85 } }
    }
  })

  it('webp / avif モードは拡張子を無視する', () => {
    expect(getCurrentFormatInfo('/a/photo.png', config({ mode: 'webp' }))).toEqual({ format: 'webp', quality: 80 })
    expect(getCurrentFormatInfo('/a/photo.jpg', config({ mode: 'avif' }))).toEqual({ format: 'avif', quality: 70 })
  })

  it('compress モードは拡張子から形式を決める', () => {
    expect(getCurrentFormatInfo('/a/photo.jpg', config({ mode: 'compress' }))).toEqual({ format: 'jpeg', quality: 75 })
    expect(getCurrentFormatInfo('/a/photo.png', config({ mode: 'compress' }))).toEqual({ format: 'png', quality: 85 })
  })

  it('jpg は jpeg に正規化する（imageOptions のキーに合わせる）', () => {
    expect(getCurrentFormatInfo('/a/photo.jpeg', config({ mode: 'compress' })).format).toBe('jpeg')
  })

  it('大文字拡張子も同じ形式として扱う', () => {
    expect(getCurrentFormatInfo('/a/photo.JPG', config({ mode: 'compress' })).format).toBe('jpeg')
  })
})
