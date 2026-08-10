import { describe, it, expect } from 'vitest'
import { referencePath } from '../../core/check/reference-url.mjs'

const OUTPUT_ROOT = '/tmp/dist'

const from =
  (fromFile, options = {}) =>
  raw =>
    referencePath(raw, { outputRoot: OUTPUT_ROOT, fromFile, ...options })

const fromRoot = from('/tmp/dist/index.html')
const fromAbout = from('/tmp/dist/about/index.html')

describe('referencePath', () => {
  it('絶対参照は出力ルート起点のまま', () => {
    expect(fromAbout('/assets/img/hero.webp')).toBe('/assets/img/hero.webp')
  })

  it('相対参照はそのファイルの位置を基点にする', () => {
    expect(fromAbout('../assets/a.css')).toBe('/assets/a.css')
    expect(fromAbout('team/')).toBe('/about/team/')
    expect(fromRoot('a.css')).toBe('/a.css')
  })

  it('ルートを超える「..」は URL 仕様どおり捨てる', () => {
    // ブラウザは /../a.png を /a.png として要求する。捨てないと、本番で届く参照を
    // 壊れていると報告することになる
    expect(fromRoot('../a.png')).toBe('/a.png')
    expect(fromAbout('../../../a.png')).toBe('/a.png')
  })

  it('外部URL・アンカー・mailto・data は検査しない', () => {
    expect(fromRoot('https://example.org/a/')).toBeNull()
    expect(fromRoot('//cdn.example.com/a.js')).toBeNull()
    expect(fromRoot('#top')).toBeNull()
    expect(fromRoot('mailto:a@example.com')).toBeNull()
    expect(fromRoot('tel:0120-000-000')).toBeNull()
    expect(fromRoot('data:image/gif;base64,R0lGOD')).toBeNull()
    expect(fromRoot('')).toBeNull()
    expect(fromRoot('   ')).toBeNull()
  })

  it('テンプレートタグを含む値は検査しない', () => {
    expect(fromRoot('<?php echo $url ?>')).toBeNull()
    expect(fromRoot('{{ url }}')).toBeNull()
    expect(fromRoot('/news/<?= $id ?>/')).toBeNull()
  })

  it('siteUrl と同じ origin の絶対URLは内部の参照として解決する', () => {
    const site = from('/tmp/dist/index.html', { origin: 'https://example.com' })

    expect(site('https://example.com/about/')).toBe('/about/')
    expect(site('https://example.com')).toBe('/')
    expect(site('https://example.org/about/')).toBeNull()
    // 前方一致だけで判定すると別ドメインを内部と誤認する
    expect(site('https://example.com.evil.test/about/')).toBeNull()
  })

  it('siteUrl が空なら絶対URLは検査しない', () => {
    expect(fromRoot('https://example.com/about/')).toBeNull()
  })

  it('ハッシュとクエリを落とす', () => {
    expect(fromRoot('/assets/sprite.svg#icon-arrow')).toBe('/assets/sprite.svg')
    expect(fromRoot('/assets/css/style.css?v=2')).toBe('/assets/css/style.css')
    expect(fromRoot('/a/?q=1#x')).toBe('/a/')
  })

  it('パーセントエンコードを復号する', () => {
    // srcset は空白とカンマをエスケープして出すので、復号しないと全部リンク切れになる
    expect(fromRoot('/img/hero%20wide.webp')).toBe('/img/hero wide.webp')
    expect(fromRoot('/img/a%2Cb.webp')).toBe('/img/a,b.webp')
    // 生の空白も同じ場所に着く
    expect(fromRoot('/img/hero wide.webp')).toBe('/img/hero wide.webp')
  })

  it('復号できない値はそのまま突き合わせる', () => {
    expect(fromRoot('/img/100%.webp')).toBe('/img/100%.webp')
  })

  it('base href があれば相対参照の基点を差し替える', () => {
    const based = from('/tmp/dist/index.html', { baseHref: '/assets/' })

    expect(based('a.png')).toBe('/assets/a.png')
    // 絶対参照は base の影響を受けない
    expect(based('/a.png')).toBe('/a.png')
  })

  it('base href が外部を指すなら、その文書の相対参照は検査しない', () => {
    const based = from('/tmp/dist/index.html', { baseHref: 'https://cdn.example.com/' })

    expect(based('a.png')).toBeNull()
  })
})
