import { describe, expect, it, vi, afterEach } from 'vitest'
import { build } from '../../index.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * siteUrl が空のまま絶対URLを組み立てると、OGP や canonical に "/about/" のような
 * 相対パスが入る。ビルドは成功し、HTML を1枚ずつ開くまで気づけない。
 *
 * 判定はページごとに起きるので、共通レイアウトから参照していると
 * ページ数だけ警告が並ぶ。並んだ警告は読まれないので 1 回に抑える。
 */
const layout = `doctype html
html
  head
    link(rel='canonical', href=Builder.url.href)
  body
    block content
`

const page = heading => `extends /_partials/_layout.pug\nblock content\n  h1 ${heading}\n`

const projectFiles = (config, layoutSource = layout) => ({
  'package.json': '{"name":"site-url","type":"module"}',
  'pugkit.config.mjs': config,
  'src/_partials/_layout.pug': layoutSource,
  'src/index.pug': page('Home'),
  'src/about.pug': page('About'),
  'src/blog/index.pug': page('Blog')
})

/** logger は console.log に出すので、そちらを横取りする */
const captureLogs = () => vi.spyOn(console, 'log').mockImplementation(() => {})

const linesMatching = (logs, pattern) => logs.mock.calls.map(args => args.join(' ')).filter(line => pattern.test(line))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('siteUrl の未設定', () => {
  it('絶対URLを参照していれば知らせる', async () => {
    const logs = captureLogs()
    const project = await createTempProject(projectFiles('export default {}\n'))

    await build(project.root)

    expect(linesMatching(logs, /siteUrl/)).toHaveLength(1)
  })

  it('ページ数が増えても 1 回しか出さない', async () => {
    const logs = captureLogs()
    const project = await createTempProject(projectFiles('export default {}\n'))

    await build(project.root)

    // 前提: 3 ページとも共通レイアウトから絶対URLを参照している
    expect(await project.read('dist/index.html')).toContain('rel="canonical"')
    expect(await project.read('dist/about.html')).toContain('rel="canonical"')
    expect(await project.read('dist/blog/index.html')).toContain('rel="canonical"')
    expect(linesMatching(logs, /siteUrl/)).toHaveLength(1)
  })

  it('どのページで参照しているかを添える', async () => {
    const logs = captureLogs()
    const project = await createTempProject(projectFiles('export default {}\n'))

    await build(project.root)

    expect(linesMatching(logs, /siteUrl/)[0]).toMatch(/\.pug/)
  })

  it('siteUrl があれば知らせない', async () => {
    const logs = captureLogs()
    const project = await createTempProject(projectFiles("export default { siteUrl: 'https://example.com/' }\n"))

    await build(project.root)

    expect(linesMatching(logs, /siteUrl/)).toEqual([])
  })

  /**
   * 相対リンクだけで組む案件は絶対URLに触らない。その使い方は正しいので、
   * siteUrl が空であること自体を理由に知らせてはいけない
   */
  it('絶対URLを参照していなければ知らせない', async () => {
    const logs = captureLogs()
    const relativeLayout = `doctype html
html
  head
    title pugkit
  body
    a(href=Builder.dir) home
    block content
`
    const project = await createTempProject(projectFiles('export default {}\n', relativeLayout))

    await build(project.root)

    // 前提: ビルドは通っていて、ページも出ている
    expect(await project.read('dist/index.html')).toContain('home')
    expect(linesMatching(logs, /siteUrl/)).toEqual([])
  })

  it('build の --site-url で指定すれば知らせない', async () => {
    const logs = captureLogs()
    const project = await createTempProject(projectFiles('export default {}\n'))
    const { createBuilder } = await import('../../index.mjs')

    const builder = await createBuilder(project.root, 'production', { siteUrl: 'https://example.com/' })
    await builder.build()
    await builder.close()

    expect(await project.read('dist/index.html')).toContain('https://example.com/')
    expect(linesMatching(logs, /siteUrl/)).toEqual([])
  })
})
