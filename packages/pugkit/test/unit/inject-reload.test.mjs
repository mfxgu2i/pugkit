import { describe, expect, it } from 'vitest'
import { injectReload } from '../../core/server.mjs'

/**
 * ライブリロードスクリプトの注入。
 *
 * 注入するのは第三者のミニファイ済みコード（idiomorph）なので、
 * 置換文字列として扱うと `$&` などが特殊解釈されてスクリプトが壊れる。
 * 現行の idiomorph には該当パターンが無いため HTTP 経由では再現できず、
 * 依存を更新した瞬間に壊れる類の回帰。ここで固定する。
 */
const HTML = '<!DOCTYPE html><html><head><title>T</title></head><body><h1>Hello</h1></body></html>'

describe('injectReload', () => {
  describe('$ を含むスクリプトを原文のまま注入する', () => {
    it.each([
      ['$&', 'マッチした </body> が混入する'],
      ['$`', 'マッチより前の HTML 全体が複製される'],
      ["$'", 'マッチより後の HTML が混入する'],
      ['$$', '$ が1個に潰れる']
    ])('%s を壊さない（誤ると%s）', pattern => {
      const script = `<script>var a="${pattern}"</script>`

      const result = injectReload(HTML, script)

      expect(result).toContain(script)
      // 長さが元 HTML + スクリプトぴったりなら、複製も欠落も起きていない
      expect(result).toHaveLength(HTML.length + script.length)
    })
  })

  it('</body> の直前に入れる（body 末尾にある前提で DOM を扱うため）', () => {
    const result = injectReload(HTML, '<script>x</script>')

    expect(result).toContain('<script>x</script></body>')
  })

  it('</body> が無ければ末尾に足す', () => {
    const result = injectReload('<p>no body tag</p>', '<script>x</script>')

    expect(result).toBe('<p>no body tag</p><script>x</script>')
  })

  it('</body> が複数あっても1回しか入れない', () => {
    const html = '<body><p>a</p></body><body><p>b</p></body>'

    const result = injectReload(html, '<script>x</script>')

    expect(result.match(/<script>x<\/script>/g)).toHaveLength(1)
  })
})
