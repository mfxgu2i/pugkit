import { describe, expect, it } from 'vitest'
import {
  convertExtension,
  densityOutputs,
  hasScaledVariant,
  isReservedImageName,
  normalizeSourceDensity,
  normalizeWidths,
  parseWidthName,
  pruneWidths,
  scaleDown,
  scaledName,
  sourceDensityOf,
  supportsDensity,
  widthDimensions,
  widthName,
  widthOutputs
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

describe('widthName', () => {
  it('幅版には @<数字>w が付く', () => {
    expect(widthName('img/a.webp', 400)).toBe('img/a@400w.webp')
  })

  it('記述子と同じ綴りにする（出力名から候補の幅が読める）', () => {
    expect(widthName('img/a.webp', 1200)).toContain('1200w')
  })
})

describe('parseWidthName', () => {
  it('幅版の名前を幹・幅・拡張子に分ける', () => {
    expect(parseWidthName('img/a@400w.webp')).toEqual({ base: 'img/a', width: 400, ext: '.webp' })
  })

  /**
   * 削除側はこの判定だけで消す対象を決める。glob を使うと
   * `a{1,2}@*w.webp` が `a1@400w.webp` と `a2@400w.webp` に当たり、
   * 自分の出力を残したまま他人の出力を消す
   */
  it('glob のメタ文字を含む名前でも幹をそのまま返す', () => {
    expect(parseWidthName('img/a{1,2}@400w.webp')).toEqual({ base: 'img/a{1,2}', width: 400, ext: '.webp' })
    expect(parseWidthName('img/st*ar@400w.webp')).toEqual({ base: 'img/st*ar', width: 400, ext: '.webp' })
  })

  it.each(['img/a.webp', 'img/a@half.webp', 'img/a@halfw.webp', 'img/a@2x.webp', 'img/a@400W.webp'])(
    '%s は幅版ではない',
    name => {
      expect(parseWidthName(name)).toBeNull()
    }
  )
})

describe('isReservedImageName', () => {
  it.each(['hero@half.jpg', 'hero@400w.jpg', 'hero@1200w.png', 'dir/hero@half.webp'])('%s は予約済み', name => {
    expect(isReservedImageName(name)).toBe(true)
  })

  /** @2x はデザインツールの書き出し名として実在するので、予約すると支給素材が置けなくなる */
  it.each(['hero.jpg', 'hero@2x.jpg', 'hero@halfw.jpg', 'hero@w.jpg', 'half.jpg', 'hero@400.jpg'])(
    '%s は予約されていない',
    name => {
      expect(isReservedImageName(name)).toBe(false)
    }
  )
})

describe('normalizeWidths', () => {
  it('未指定は幅なし', () => {
    expect(normalizeWidths(undefined)).toEqual({ widths: [], dropped: [] })
  })

  it('昇順にして重複を除く', () => {
    expect(normalizeWidths([800, 400, 800]).widths).toEqual([400, 800])
  })

  it('使えない値は落として dropped に入れる', () => {
    const result = normalizeWidths([800, -100, '600', 0, 1.5, null])

    expect(result.widths).toEqual([800])
    expect(result.dropped).toEqual([-100, '600', 0, 1.5, null])
  })

  it('配列でない値はまるごと落とす', () => {
    expect(normalizeWidths(400)).toEqual({ widths: [], dropped: [400] })
  })
})

describe('pruneWidths', () => {
  it('原寸未満だけ残す', () => {
    expect(pruneWidths([400, 800, 1200], 1000)).toEqual([400, 800])
  })

  /** 原寸と同じ幅は無印が兼ねる。作ると同じ中身が 2 枚出る */
  it('原寸と同じ幅は作らない', () => {
    expect(pruneWidths([800, 1600], 1600)).toEqual([800])
  })

  it('原寸が読めなければ 1 つも残さない', () => {
    expect(pruneWidths([400], undefined)).toEqual([])
  })
})

describe('widthDimensions', () => {
  it('縦は原寸の比率から決める', () => {
    expect(widthDimensions(1600, 1200, 400)).toEqual({ width: 400, height: 300 })
  })

  it('0 は返さない（sharp に 0 を渡すと失敗する）', () => {
    expect(widthDimensions(1600, 1, 400).height).toBe(1)
  })
})

describe('widthOutputs', () => {
  it('幅の昇順で返し、無印が最大の候補を兼ねる', () => {
    expect(widthOutputs('img/a.jpg', 'webp', [400, 800], 1600)).toEqual([
      { name: 'img/a@400w.webp', width: 400 },
      { name: 'img/a@800w.webp', width: 800 },
      { name: 'img/a.webp', width: 1600 }
    ])
  })

  it('原寸以上の幅は並ばない', () => {
    expect(widthOutputs('img/a.jpg', 'webp', [400, 1600, 2000], 1600).map(out => out.width)).toEqual([400, 1600])
  })

  it.each(['img/a.gif', 'img/a.svg'])('%s は幅の対象外で無印だけ返す', name => {
    expect(widthOutputs(name, 'webp', [400], 1600)).toHaveLength(1)
  })
})
