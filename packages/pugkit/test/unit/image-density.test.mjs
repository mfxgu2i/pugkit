import { describe, expect, it } from 'vitest'
import {
  convertExtension,
  densityOutputs,
  hasScaledVariant,
  normalizeSourceDensity,
  scaleDown,
  scaledName,
  sourceDensityOf,
  supportsDensity
} from '../../utils/image-density.mjs'

/**
 * 出力名と寸法の規則。生成側（tasks/image.mjs）と参照側（transform/image-size.mjs）が
 * ここを共有していないと、HTML に書く width/height と実際の画像がずれて CLS になる。
 */

describe('scaleDown', () => {
  it.each([
    [1600, 2, 800],
    [1601, 2, 801],
    [1599, 2, 800],
    [3, 2, 2],
    [800, 1, 800]
  ])('scaleDown(%i, %i) === %i', (value, density, expected) => {
    expect(scaleDown(value, density)).toBe(expected)
  })

  it('0 は返さない（sharp に 0 を渡すと失敗する）', () => {
    expect(scaleDown(1, 2)).toBe(1)
  })
})

describe('hasScaledVariant', () => {
  it('縮小して寸法が変わるなら true', () => {
    expect(hasScaledVariant(800, 600, 2)).toBe(true)
  })

  it('density 1 では常に false', () => {
    expect(hasScaledVariant(800, 600, 1)).toBe(false)
  })

  it('1x1 は縮小しても同じ寸法なので false', () => {
    expect(hasScaledVariant(1, 1, 2)).toBe(false)
  })

  it('片側しか縮まない場合はアスペクト比が崩れるので false', () => {
    expect(hasScaledVariant(3, 1, 2)).toBe(false)
  })

  it('寸法が読めなかった場合は false', () => {
    expect(hasScaledVariant(undefined, undefined, 2)).toBe(false)
  })
})

describe('normalizeSourceDensity / sourceDensityOf', () => {
  it.each([1, 2])('%i は有効', value => {
    expect(normalizeSourceDensity(value)).toBe(value)
  })

  it.each([3, 0, -1, '2', 1.5, null, undefined])('%p は無効', value => {
    expect(normalizeSourceDensity(value)).toBeNull()
  })

  it('未設定・不正値は 1 に倒す（1 枚も出力されない事故を防ぐ）', () => {
    expect(sourceDensityOf(undefined)).toBe(1)
    expect(sourceDensityOf({ build: {} })).toBe(1)
    expect(sourceDensityOf({ build: { image: {} } })).toBe(1)
    expect(sourceDensityOf({ build: { image: { sourceDensity: 3 } } })).toBe(1)
    expect(sourceDensityOf({ build: { image: { sourceDensity: 2 } } })).toBe(2)
  })
})

describe('convertExtension', () => {
  it.each([
    ['img/a.jpg', 'webp', 'img/a.webp'],
    ['img/a.PNG', 'webp', 'img/a.webp'],
    ['img/a.gif', 'avif', 'img/a.avif'],
    ['img/a.jpg', 'compress', 'img/a.jpg'],
    ['img/a.svg', 'webp', 'img/a.svg'],
    ['img/a.jpg', null, 'img/a.jpg']
  ])('%s (%s) -> %s', (name, optimization, expected) => {
    expect(convertExtension(name, optimization)).toBe(expected)
  })
})

describe('scaledName', () => {
  it('縮小版には @half が付く', () => {
    expect(scaledName('img/a.webp')).toBe('img/a@half.webp')
  })

  it('@1x を使わない（デザインツールの書き出し名と衝突するため）', () => {
    expect(scaledName('img/a.webp')).not.toContain('@1x')
  })
})

describe('supportsDensity', () => {
  it.each([
    ['a.jpg', true],
    ['a.jpeg', true],
    ['a.PNG', true],
    ['a.gif', false],
    ['a.svg', false],
    ['a.webp', false]
  ])('%s -> %s', (name, expected) => {
    expect(supportsDensity(name)).toBe(expected)
  })
})

describe('densityOutputs', () => {
  it('density 1 では原寸 1 枚', () => {
    expect(densityOutputs('img/a.jpg', 'webp', 1)).toEqual([{ name: 'img/a.webp', density: 1 }])
  })

  it('density 2 では原寸と縮小版。筆頭は必ず原寸', () => {
    expect(densityOutputs('img/a.jpg', 'webp', 2)).toEqual([
      { name: 'img/a.webp', density: 2 },
      { name: 'img/a@half.webp', density: 1 }
    ])
  })

  it('GIF は変換だけされて密度は適用されない', () => {
    expect(densityOutputs('img/a.gif', 'webp', 2)).toEqual([{ name: 'img/a.webp', density: 2 }])
  })

  it('SVG は変換も密度も適用されない', () => {
    expect(densityOutputs('img/a.svg', 'webp', 2)).toEqual([{ name: 'img/a.svg', density: 2 }])
  })
})
