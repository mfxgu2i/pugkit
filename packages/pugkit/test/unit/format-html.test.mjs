import { describe, expect, it } from 'vitest'
import { formatHtml } from '../../transform/html.mjs'
import { defaultConfig } from '../../config/defaults.mjs'

/**
 * 既定の整形設定で出力される HTML の性質。
 *
 * 定数がその値であることではなく、「その設定で出た HTML が表示を変えないか」を見る。
 * 整形は納品物そのものなので、崩れても例外にならず、ブラウザで開くまで気づけない。
 */
const format = html => formatHtml(html, defaultConfig.build.html)

describe('インライン要素', () => {
  /**
   * js-beautify の inline を空配列で上書きすると、インライン要素が改行されて
   * そこに空白が生まれる。inline-block で詰めて並べたナビゲーションが、
   * ソースには無いはずの隙間を持つ。
   */
  it('隣り合うインライン要素の間に空白を入れない', () => {
    expect(format('<p><span>a</span><span>b</span></p>')).toContain('<span>a</span><span>b</span>')
  })

  it('リスト項目の中のリンクを改行しない', () => {
    const output = format('<ul><li><a href="#">A</a></li><li><a href="#">B</a></li></ul>')

    expect(output).toContain('<li><a href="#">A</a></li>')
    expect(output).toContain('<li><a href="#">B</a></li>')
  })

  it('テキストに挟まれた要素をそのまま保つ', () => {
    expect(format('<p>foo<br>bar</p>')).toContain('<p>foo<br>bar</p>')
  })

  // 前提の確認。すべて 1 行になるだけなら上の 3 つは自明に通る
  it('ブロック要素は改行して字下げする', () => {
    expect(format('<div><p>a</p><p>b</p></div>')).toBe('<div>\n  <p>a</p>\n  <p>b</p>\n</div>\n')
  })
})

describe('中身を整形しない要素', () => {
  /**
   * textarea の中身は表示される値そのもの。整形すると値が変わる。
   * js-beautify の既定には入っているので、content_unformatted を
   * 上書きするときに落とさないこと
   */
  it('textarea の改行と字下げを保つ', () => {
    expect(format('<textarea>\n  keep\n</textarea>')).toContain('<textarea>\n  keep\n</textarea>')
  })

  it('pre の改行と字下げを保つ', () => {
    expect(format('<pre>\n  raw\n</pre>')).toContain('<pre>\n  raw\n</pre>')
  })

  it('script の中身に触らない', () => {
    expect(format('<script>const a=1;  const b=2;</script>')).toContain('<script>const a=1;  const b=2;</script>')
  })

  it('style の中身に触らない', () => {
    expect(format('<style>.a{color:red}  .b{color:blue}</style>')).toContain(
      '<style>.a{color:red}  .b{color:blue}</style>'
    )
  })
})

describe('全体', () => {
  it('末尾を改行で終える', () => {
    expect(format('<p>a</p>')).toMatch(/\n$/)
  })

  it('ゼロ幅文字を落とす（コピー由来の不可視文字を納品物に残さない）', () => {
    expect(format('<p>a​b</p>')).toContain('<p>ab</p>')
  })

  it('head の前に空行を入れない', () => {
    expect(format('<html><head><title>t</title></head></html>')).not.toMatch(/\n\s*\n/)
  })
})
