import { describe, expect, it } from 'vitest'
import { pageCandidates } from '../../utils/page-candidates.mjs'

/**
 * URL からページ候補への展開。
 *
 * Pug ページ（.pug）と public 由来の既存 HTML（.html）で順序が違うと、
 * 同じ形の URL でも別の階層のファイルが選ばれる。両者が同じ規則から導かれることを
 * ここで固定しておかないと、片方だけ直したときに気づけない。
 */
describe('pageCandidates', () => {
  it.each([
    ['/', ['/index.pug']],
    ['/about.html', ['/about.pug']],
    ['/about', ['/about.pug', '/about/index.pug']],
    ['/about/', ['/about.pug', '/about/index.pug']],
    ['/blog/index.html', ['/blog/index.pug']]
  ])('%s を展開する', (urlPath, expected) => {
    expect(pageCandidates(urlPath, '.pug')).toEqual(expected)
  })

  it('末尾スラッシュの有無で候補順が変わらない（sirv の解決順に合わせる）', () => {
    expect(pageCandidates('/blog/', '.pug')).toEqual(pageCandidates('/blog', '.pug'))
  })

  it('フラットファイルを index より先に見る', () => {
    expect(pageCandidates('/blog', '.pug')).toEqual(['/blog.pug', '/blog/index.pug'])
  })

  it('.html 以外の拡張子はページとして扱わない', () => {
    expect(pageCandidates('/css/style.css', '.pug')).toBeNull()
    expect(pageCandidates('/img/a.png', '.pug')).toBeNull()
  })

  it('.html は大文字小文字を問わない', () => {
    expect(pageCandidates('/about.HTML', '.pug')).toEqual(['/about.pug'])
  })

  it('「/」始まりでない URL は扱わない', () => {
    expect(pageCandidates('about.html', '.pug')).toBeNull()
  })

  /**
   * 拡張子だけが違う同じ規則であることの確認。
   * どちらかにだけ候補を足すと、この対応が崩れて経路ごとに解決先がずれる
   */
  it('.pug と .html で候補の形が一致する', () => {
    for (const urlPath of ['/', '/about.html', '/about', '/about/', '/blog/index.html', '/css/style.css']) {
      const pug = pageCandidates(urlPath, '.pug')
      const html = pageCandidates(urlPath, '.html')

      expect(html).toEqual(pug === null ? null : pug.map(candidate => candidate.replace(/\.pug$/, '.html')))
    }
  })
})
