import { describe, it, expect } from 'vitest'
import { symlink } from 'node:fs/promises'
import { check } from '../../index.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * check は build をせず、既にある出力を読む。
 * ここでは dist を直接書いて、参照の解決規則だけを見る。
 */

const messages = findings => findings.map(finding => `${finding.file} ${finding.message}`)
const targets = findings => findings.map(finding => finding.message.replace('参照が見つかりません: ', ''))

async function checkProject(files, { config = 'export default {}' } = {}) {
  const project = await createTempProject({
    'package.json': '{"name":"fixture","type":"module"}',
    'pugkit.config.mjs': config,
    ...files
  })

  return check(project.root, ['references'])
}

describe('参照の実在検査', () => {
  it('実在しない参照だけを報告する', async () => {
    const { findings } = await checkProject({
      'dist/index.html': [
        '<a href="/about/">ある</a>',
        '<a href="/nowhere/">ない</a>',
        '<a href="https://example.org/x/">外部</a>',
        '<a href="#top">アンカー</a>',
        '<a href="mailto:a@example.com">メール</a>',
        '<a href="<?php echo $url ?>">テンプレートタグ</a>',
        '<!-- <a href="/commented/">コメント</a> -->',
        '<img src="img/hero%20wide.png" srcset="img/hero%20wide.png 1x, img/missing.png 2x">',
        '<link rel="stylesheet" href="/css/style.css?v=2">'
      ].join('\n'),
      'dist/about/index.html': '<p>about</p>',
      'dist/img/hero wide.png': 'x',
      'dist/css/style.css':
        '.a { background-image: url(../img/hero%20wide.png); }\n.b { background: url(../img/gone.png); }'
    })

    // 「報告しない」の確認より先に、検査自体が動いていることを固定する
    expect(targets(findings)).toContain('/nowhere/')

    expect(messages(findings).sort()).toEqual([
      'css/style.css 参照が見つかりません: ../img/gone.png',
      'index.html 参照が見つかりません: /nowhere/',
      'index.html 参照が見つかりません: img/missing.png'
    ])
  })

  it('末尾スラッシュのディレクトリ指定を index.html に読み替える', async () => {
    const { findings } = await checkProject({
      'dist/index.html': ['<a href="/about/">a</a>', '<a href="/about">b</a>', '<a href="/team/">c</a>'].join('\n'),
      'dist/about/index.html': '<p>about</p>'
    })

    expect(targets(findings)).toEqual(['/team/'])
  })

  it('相対参照はそのファイルの位置を基点にする', async () => {
    const { findings } = await checkProject({
      'dist/about/index.html': ['<a href="../">a</a>', '<a href="team/">b</a>', '<a href="../missing.html">c</a>'].join(
        '\n'
      ),
      'dist/index.html': '<p>home</p>',
      'dist/about/team/index.html': '<p>team</p>'
    })

    expect(targets(findings)).toEqual(['../missing.html'])
  })

  it('CSS の url() は CSS ファイルの位置から解決する', async () => {
    const { findings } = await checkProject({
      'dist/index.html': '<link rel="stylesheet" href="/assets/css/style.css">',
      'dist/assets/css/style.css': '.a { background: url(../img/bg.png); }\n.b { background: url(bg.png); }',
      'dist/assets/img/bg.png': 'x'
    })

    // HTML 基点で解くと ../img/bg.png が壊れていると報告される
    expect(targets(findings)).toEqual(['bg.png'])
  })

  it('ルートを超える「..」はブラウザと同じく畳んで解決する', async () => {
    const { findings } = await checkProject({
      'dist/index.html': ['<a href="../inside.html">畳めば届く</a>', '<a href="../missing.html">畳んでも無い</a>'].join(
        '\n'
      ),
      // ブラウザは /../inside.html を /inside.html として要求する。
      // 出力ルートの外に同名のファイルがあっても、そちらは決して届かない
      'dist/inside.html': '<p>ルートの中</p>',
      'missing.html': '<p>ルートの外。ここには届かない</p>'
    })

    expect(targets(findings)).toEqual(['../missing.html'])
  })

  it('拡張子の無い実ファイルへの参照を報告しない', async () => {
    const { findings } = await checkProject({
      'dist/index.html': ['<a href="/CNAME">ある</a>', '<a href="/LICENSE">ない</a>'].join('\n'),
      'dist/CNAME': 'example.com'
    })

    // ページ候補（CNAME.html / CNAME/index.html）だけを見ると、実ファイルに当たらない
    expect(targets(findings)).toEqual(['/LICENSE'])
  })

  it('ディレクトリに当たっただけでは実在とみなさない', async () => {
    const { findings } = await checkProject({
      'dist/index.html': ['<a href="/v1.2/">index が無い</a>', '<a href="/v1.3/">index がある</a>'].join('\n'),
      'dist/v1.2/readme.txt': 'x',
      'dist/v1.3/index.html': '<p>ある</p>'
    })

    // 本番の静的配信はディレクトリを返せない
    expect(targets(findings)).toEqual(['/v1.2/'])
  })

  it('base href を相対参照の基点にする', async () => {
    const { findings } = await checkProject({
      'dist/index.html': ['<base href="/assets/">', '<img src="a.png">', '<img src="b.png">'].join('\n'),
      'dist/assets/a.png': 'x'
    })

    // base 自体を参照として扱うと /assets/ が実在しないと報告される
    expect(targets(findings)).toEqual(['b.png'])
  })

  it('srcset の data URI を候補として扱わない', async () => {
    const { findings } = await checkProject({
      'dist/index.html': '<img srcset="data:image/png;base64,iVBORw0KGgo= 1x, /b.png 2x">',
      'dist/b.png': 'x'
    })

    expect(findings).toEqual([])
  })

  it('CSS の image-set と @import も見る', async () => {
    const { findings } = await checkProject({
      'dist/index.html': '<link rel="stylesheet" href="/style.css">',
      'dist/style.css': [
        '@import "parts.css";',
        '.a { background-image: image-set(url(bg.webp) 1x, url(bg@2x.webp) 2x); }'
      ].join('\n'),
      'dist/parts.css': '.b { color: red; }',
      'dist/bg.webp': 'x'
    })

    expect(targets(findings)).toEqual(['bg@2x.webp'])
  })

  it('読めないファイルがあっても他のファイルの報告は残す', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"fixture","type":"module"}',
      'pugkit.config.mjs': 'export default {}',
      'dist/index.html': '<a href="/nowhere/">ない</a>'
    })

    // 壊れたシンボリックリンクは glob には出るが読めない
    await symlink('/存在しないパス', project.path('dist/dangling.html'))

    const { findings } = await check(project.root, ['references'])

    expect(findings.map(finding => finding.rule).sort()).toEqual(['missing-reference', 'unreadable-file'])
  })

  it('出力に検査対象が無ければ、その旨を伝える', async () => {
    const { findings, notices } = await checkProject({ 'dist/.gitkeep': '' })

    expect(findings).toEqual([])
    expect(notices.join('\n')).toMatch(/検査していません/)
  })

  it('subdir を含んだ絶対パスを解決する', async () => {
    const { findings } = await checkProject(
      {
        'dist/sub/index.html': ['<a href="/sub/about/">a</a>', '<a href="/about/">b</a>'].join('\n'),
        'dist/sub/about/index.html': '<p>about</p>'
      },
      { config: "export default { subdir: 'sub' }" }
    )

    // subdir を付け忘れた絶対パスは本番で 404 になる
    expect(targets(findings)).toEqual(['/about/'])
  })

  it('siteUrl と同じ origin の絶対URLを解決する', async () => {
    const { findings } = await checkProject(
      {
        'dist/index.html': [
          '<link rel="canonical" href="https://example.com/about/">',
          '<meta property="og:image" content="https://example.com/img/ogp.png">',
          '<a href="https://example.org/about/">外部</a>'
        ].join('\n'),
        'dist/about/index.html': '<p>about</p>'
      },
      { config: "export default { siteUrl: 'https://example.com' }" }
    )

    expect(targets(findings)).toEqual(['https://example.com/img/ogp.png'])
  })

  it('出力先が無ければ検査せずに知らせる', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"fixture","type":"module"}',
      'pugkit.config.mjs': 'export default {}'
    })

    await expect(check(project.root, ['references'])).rejects.toThrow(/pugkit build/)
  })
})
