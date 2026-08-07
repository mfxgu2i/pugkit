import { describe, expect, it } from 'vitest'
import { normalizeSubdir } from '../../config/main.mjs'

/**
 * subdir は URL の組み立てと出力先パスの組み立ての両方に使う。
 * 先頭スラッシュが残ると resolve() が絶対パス扱いし、出力先が outDir の外に出る。
 */
describe('normalizeSubdir', () => {
  it.each([
    ['sub', 'sub'],
    ['sub/', 'sub'],
    ['/sub', 'sub'],
    ['/sub/', 'sub'],
    ['//sub//', 'sub'],
    ['a/b', 'a/b'],
    ['/a/b/', 'a/b'],
    ['', ''],
    [undefined, ''],
    [null, '']
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSubdir(input)).toBe(expected)
  })
})
