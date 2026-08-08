import { describe, expect, it } from 'vitest'
import { computeMorphSignature } from '../../core/dev/client-script.mjs'

/**
 * body の差分適用では反映できない部分の指紋。
 * 前回そのページに返した HTML と一致していればクライアントに差分適用させる。
 *
 * ここで拾い漏らすと「保存したのに反映されない」が静かに起きる。
 */
const page = ({ htmlAttrs = '', head = '<title>T</title>', body = '<p>hi</p>' } = {}) =>
  `<!DOCTYPE html><html${htmlAttrs}><head>${head}</head><body>${body}</body></html>`

describe('computeMorphSignature', () => {
  it('body だけの変更では変わらない（差分適用できる）', () => {
    expect(computeMorphSignature(page({ body: '<p>before</p>' }))).toBe(
      computeMorphSignature(page({ body: '<p>after</p>' }))
    )
  })

  it('head の変更を検出する', () => {
    expect(computeMorphSignature(page({ head: '<title>A</title>' }))).not.toBe(
      computeMorphSignature(page({ head: '<title>B</title>' }))
    )
  })

  it('head へのタグ追加を検出する', () => {
    expect(computeMorphSignature(page())).not.toBe(
      computeMorphSignature(page({ head: '<title>T</title><meta name="description" content="x">' }))
    )
  })

  it('<html> の属性変更を検出する（body 限定の差分適用では反映できない）', () => {
    expect(computeMorphSignature(page({ htmlAttrs: ' lang="ja"' }))).not.toBe(
      computeMorphSignature(page({ htmlAttrs: ' lang="en"' }))
    )
  })

  it('<html> への属性追加を検出する', () => {
    expect(computeMorphSignature(page())).not.toBe(computeMorphSignature(page({ htmlAttrs: ' data-theme="dark"' })))
  })

  it('body 内 <script> の変更を検出する（差分適用では再実行されない）', () => {
    expect(computeMorphSignature(page({ body: '<script>a()</script>' }))).not.toBe(
      computeMorphSignature(page({ body: '<script>b()</script>' }))
    )
  })

  it('body への <script> 追加を検出する', () => {
    expect(computeMorphSignature(page())).not.toBe(computeMorphSignature(page({ body: '<p>hi</p><script>a()</script>' })))
  })

  it('head 内 <script> の変更を検出する', () => {
    expect(computeMorphSignature(page({ head: '<script src="/a.js"></script>' }))).not.toBe(
      computeMorphSignature(page({ head: '<script src="/b.js"></script>' }))
    )
  })
})
