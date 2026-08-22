import { describe, expect, it } from 'vitest'
import { normalizeSubdir, stripSubdir } from '../../utils/subdir.mjs'

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

/**
 * dev のページ配信・幅違いのリクエスト時生成・imageInfo のルート相対解決が同じ規則で解く。
 * 境界を見ないと /subsite が /sub の配下と判定され、別のファイルを指す
 */
describe('stripSubdir', () => {
  it.each([
    ['/sub', '/sub', '/'],
    ['/sub/', '/sub', '/'],
    ['/sub/a/b.png', '/sub', '/a/b.png'],
    ['/sub/sub/a.png', '/sub', '/sub/a.png'],
    ['/a/b.png', '', '/a/b.png'],
    ['/sub/a.png', '', '/sub/a.png']
  ])('%s（subdir %s） -> %s', (urlPath, subdir, expected) => {
    expect(stripSubdir(urlPath, subdir)).toBe(expected)
  })

  it.each([
    ['/subsite/a.png', '/sub'],
    ['/a.png', '/sub'],
    ['/', '/sub']
  ])('%s（subdir %s）は subdir の外なので null', (urlPath, subdir) => {
    expect(stripSubdir(urlPath, subdir)).toBeNull()
  })
})
