import { describe, it, expect } from 'vitest'
import { collectCssReferences } from '../../core/check/css-references.mjs'

const collect = css => collectCssReferences(css, 'style.css')

describe('collectCssReferences', () => {
  it('url() を集め、コメントの中は集めない', () => {
    const { references, error } = collect(
      ['/* .b { background: url(../img/dead.png); } */', '.a { background-image: url(../img/bg.png); }'].join('\n')
    )

    expect(error).toBeNull()
    // 位置は 1 行目の既定値ではなく、実際に書かれた行を指す
    expect(references).toEqual([{ value: '../img/bg.png', line: 2, column: 24 }])
  })

  it('image-set の中の url() も集める', () => {
    // Retina 対応の背景画像はここに書かれる。Url visitor には届かない
    const { references } = collect('\n.a { background-image: image-set(url(x.webp) 1x, url(y.webp) 2x); }')

    expect(references.map(reference => reference.value)).toEqual(['x.webp', 'y.webp'])
    expect(references[0].line).toBe(2)
  })

  it('@import の参照も集める', () => {
    const { references } = collect('\n@import "missing.css";\n@import url(m2.css);')

    expect(references.map(reference => reference.value)).toEqual(['missing.css', 'm2.css'])
    expect(references[0].line).toBe(2)
  })

  it('古いハックがあっても解析を続けて url() を拾う', () => {
    // 1 行のハックでその CSS 全体が無検査になる方が損
    const { references, error } = collect('.a { *zoom: 1; background: url(hack.png); }')

    expect(error).toBeNull()
    expect(references.map(reference => reference.value)).toEqual(['hack.png'])
  })

  it('不正な宣言や未知の at-rule があっても、後ろの url() を拾う', () => {
    const { references, error } = collect(
      ['.a { color: ; }', '@unknown-rule foo;', '.b { background: url(after.png); }'].join('\n')
    )

    expect(error).toBeNull()
    expect(references.map(reference => reference.value)).toEqual(['after.png'])
  })
})
