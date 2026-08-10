import { describe, it, expect } from 'vitest'
import { collectHtmlReferences, splitSrcset } from '../../core/check/html-references.mjs'

const values = html => collectHtmlReferences(html).references.map(reference => reference.value)

describe('collectHtmlReferences', () => {
  it('href / src / poster / xlink:href を要素を問わず集める', () => {
    const html = [
      '<a href="/a/">a</a>',
      '<link rel="stylesheet" href="/s.css">',
      '<script src="/s.js"></script>',
      '<video poster="/p.jpg"><track src="/t.vtt"></video>',
      '<svg><use href="/sprite.svg#i"></use></svg>',
      '<svg><use xlink:href="/old.svg#i"></use></svg>'
    ].join('\n')

    expect(values(html)).toEqual(['/a/', '/s.css', '/s.js', '/p.jpg', '/t.vtt', '/sprite.svg#i', '/old.svg#i'])
  })

  it('srcset を候補ごとに分解する', () => {
    const html = '<img src="/a.webp" srcset="/a.webp 1x, /a@2x.webp 2x">'

    expect(values(html)).toEqual(['/a.webp', '/a.webp', '/a@2x.webp'])
  })

  it('コメントと script の中身は集めない', () => {
    // 正規表現で拾うと、退避させた古いマークアップが毎回リンク切れとして報告される
    const html = [
      '<a href="/live/">live</a>',
      '<!-- <a href="/commented/">dead</a> -->',
      '<script>var s = \'<img src="/in-script.png">\'</script>'
    ].join('\n')

    expect(values(html)).toEqual(['/live/'])
  })

  it('meta は og:image / og:url / twitter:image の content だけを集める', () => {
    const html = [
      '<meta property="og:image" content="/ogp.png">',
      '<meta property="og:url" content="https://example.com/">',
      '<meta name="twitter:image" content="/tw.png">',
      '<meta name="description" content="説明文です">',
      '<meta property="og:title" content="題名">'
    ].join('\n')

    expect(values(html)).toEqual(['/ogp.png', 'https://example.com/', '/tw.png'])
  })

  it('base href は参照ではなく解決の基点として返す', () => {
    // リンク先ではなく規則を変える指定なので、実在を問うと必ず外れる
    const { references, baseHref } = collectHtmlReferences('<base href="/assets/"><img src="a.png">')

    expect(baseHref).toBe('/assets/')
    expect(references.map(reference => reference.value)).toEqual(['a.png'])
  })

  it('base が無ければ baseHref は null', () => {
    expect(collectHtmlReferences('<img src="a.png">').baseHref).toBeNull()
  })

  it('参照の位置を行と列で返す', () => {
    const html = '<html>\n<body>\n  <a href="/a/">a</a>\n    <img src="/b.png">\n</body>\n</html>'

    expect(collectHtmlReferences(html).references).toEqual([
      { value: '/a/', line: 3, column: 3 },
      { value: '/b.png', line: 4, column: 5 }
    ])
  })
})

describe('splitSrcset', () => {
  it('記述子を落として URL だけを返す', () => {
    expect(splitSrcset('/a.webp 1x, /b.webp 2x')).toEqual(['/a.webp', '/b.webp'])
    expect(splitSrcset('/a.webp 400w,/b.webp 800w')).toEqual(['/a.webp', '/b.webp'])
    expect(splitSrcset('/a.webp')).toEqual(['/a.webp'])
    expect(splitSrcset('')).toEqual([])
  })

  it('記述子の無い候補を並べても分解する', () => {
    expect(splitSrcset('/a.webp, /b.webp')).toEqual(['/a.webp', '/b.webp'])
  })

  it('data URI をカンマで切らない', () => {
    // base64 はカンマを含むので、単純な分割だと本体が参照として残る
    expect(splitSrcset('data:image/png;base64,iVBORw0KGgo= 1x, /b.png 2x')).toEqual([
      'data:image/png;base64,iVBORw0KGgo=',
      '/b.png'
    ])
  })
})
