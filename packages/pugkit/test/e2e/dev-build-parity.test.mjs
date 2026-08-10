import { describe, expect, it, beforeEach, onTestFinished } from 'vitest'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { build } from '../../index.mjs'
import { buildPageHtml } from '../../tasks/pug.mjs'
import { createTempProject, listFiles, createTestBuilder } from '../helpers/project.mjs'

/**
 * dev で見ているものと build が出すものが食い違わないこと。
 *
 * 食い違うと「dev で確認して OK だったのに本番で崩れる」という、
 * もっとも発見が遅れる事故になる。
 * HTML は完全一致、アセットはバイト一致、CSS/JS は意図的な差分のみを許す。
 */
const layout = `doctype html
html(lang='ja')
  head
    meta(charset='utf-8')
    title= Builder.url.pathname
    link(rel='stylesheet', href=Builder.dir + 'assets/css/style.css')
  body
    a(href=Builder.dir) home
    block content
`

const page = (heading, body = '') => `extends /_partials/_layout.pug
block content
  h1 ${heading}
${body}`

async function createProject(overrides = {}) {
  const project = await createTempProject({
    'package.json': '{"name":"parity","type":"module"}',
    'pugkit.config.mjs': "export default { siteUrl: 'https://example.com/' }\n",
    'src/_partials/_layout.pug': layout,
    'src/index.pug': page('Home', '  +figure\n'),
    'src/about.pug': page('About'),
    'src/blog/index.pug': page('Blog'),
    'src/blog/deep/nested.pug': page('Nested', '  +figure\n'),
    'src/assets/css/style.scss': '.a { color: red; .b { color: blue; } }\n',
    'src/assets/js/main.js': 'console.log("hi")\n',
    'src/assets/icons/arrow.svg':
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#f00" d="M1 1h2v2H1z"/></svg>\n',
    'src/assets/logo.svg':
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20"/></svg>\n',
    'public/robots.txt': 'User-agent: *\n',
    ...overrides
  })

  // 画像の寸法は HTML に焼き込まれるので、dev/build で同じ値になるか確かめる材料にする
  const jpeg = (w, h) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .jpeg()
      .toBuffer()
  const { writeFile, mkdir } = await import('node:fs/promises')
  await mkdir(project.path('src/assets/img'), { recursive: true })
  // 寸法は imageSize()/imageInfo() を呼んだときだけ HTML に焼き込まれる。
  // dev だけが imageGraph を作るので、ここが dev/build で食い違いやすい
  await project.write({
    'src/_partials/_mixins.pug': `mixin figure
  - const info = imageInfo('/assets/img/hero.jpg')
  img(src=info.src, srcset=info.srcset, width=info.width, height=info.height)
  if info.variant
    source(srcset=info.variant.srcset, width=info.variant.width, height=info.variant.height)
`
  })
  await writeFile(project.path('src/assets/img/hero.jpg'), await jpeg(800, 600))
  await writeFile(project.path('src/assets/img/hero_sp.jpg'), await jpeg(376, 300))

  return project
}

/** dev の初期タスク（Pug 以外）を build と同じ材料から走らせる */
async function runDevAssets(project) {
  const builder = await createTestBuilder(project.root, 'development')
  builder.context.config.server.port = 0
  const { context } = builder

  for (const name of ['sass', 'script', 'image', 'svg', 'sprite', 'copy']) {
    await builder.runTask(name)
  }

  return context
}

let project

beforeEach(async () => {
  project = await createProject({
    'src/_partials/_layout.pug': layout.replace('block content', 'include /_partials/_mixins.pug\n    block content')
  })
})

describe('HTML', () => {
  it('すべてのページで dev の配信内容と build の出力が一致する', async () => {
    await build(project.root)

    const devContext = (await createTestBuilder(project.root, 'development')).context
    const pages = ['index.pug', 'about.pug', 'blog/index.pug', 'blog/deep/nested.pug']

    for (const relativePath of pages) {
      const served = await buildPageHtml(project.path(`src/${relativePath}`), devContext)
      const built = await project.read(`dist/${relativePath.replace(/\.pug$/, '.html')}`)

      expect(served, `${relativePath} が食い違っている`).toBe(built)
    }

    // 寸法が焼き込まれていること自体も確かめる（両方とも空なら一致してしまう）
    // imageSourceDensity: 2 が既定なので 800x600 の原本は表示 400x300 になる
    expect(await project.read('dist/index.html')).toMatch(/width="400"/)
  })

  it('焼き込まれた width/height が、実際に出力された画像の寸法と一致する', async () => {
    await build(project.root)

    const html = await project.read('dist/index.html')
    const src = html.match(/<img src="([^"]+)"/)[1]
    const width = Number(html.match(/width="(\d+)"/)[1])
    const height = Number(html.match(/height="(\d+)"/)[1])

    const output = await sharp(project.path(`dist${src}`)).metadata()

    expect(output).toMatchObject({ width, height })
  })

  it('srcset に並ぶ URL がすべて実ファイルに対応する', async () => {
    await build(project.root)

    const html = await project.read('dist/index.html')
    const srcset = html.match(/srcset="([^"]+)"/)[1]
    const urls = srcset.split(',').map(entry => entry.trim().split(/\s+/)[0])

    // 前提: 密度つきの srcset が実際に出ている（1 枚だけなら以下の検査が骨抜きになる）
    expect(urls).toHaveLength(2)
    expect(srcset).toBe('/assets/img/hero@half.webp 1x, /assets/img/hero.webp 2x')

    const built = await listFiles(project.path('dist'))
    for (const url of urls) {
      expect(built, `${url} が出力されていない`).toContain(url.replace(/^\//, ''))
    }
  })

  it('アートディレクション画像にも密度が効く（source の寸法が実寸の 2 倍にならない）', async () => {
    await build(project.root)

    const html = await project.read('dist/index.html')
    const source = html.match(/<source srcset="([^"]+)" width="(\d+)" height="(\d+)"/)

    expect(source[1]).toBe('/assets/img/hero_sp@half.webp 1x, /assets/img/hero_sp.webp 2x')

    const output = await sharp(project.path(`dist/assets/img/hero_sp@half.webp`)).metadata()
    expect(output).toMatchObject({ width: Number(source[2]), height: Number(source[3]) })
  })

  it('subdir を設定しても一致する', async () => {
    await project.write({
      'pugkit.config.mjs': "export default { siteUrl: 'https://example.com/', subdir: 'sub' }\n"
    })
    await build(project.root)

    const devContext = (await createTestBuilder(project.root, 'development')).context
    const served = await buildPageHtml(project.path('src/blog/index.pug'), devContext)

    expect(served).toBe(await project.read('dist/sub/blog/index.html'))
  })

  it('dev サーバー越しでも（注入分を除けば）build と一致する', async () => {
    await build(project.root)

    const builder = await createTestBuilder(project.root, 'development')
    builder.context.config.server.port = 0
    await builder.tasks.server(builder.context)

    const res = await fetch(`http://localhost:${builder.context.server.port}/about.html`)
    const html = await res.text()
    // 注入分は目印属性で見分ける（スクリプトの書き方が変わっても剥がせる）
    const withoutInjection = html.replace(/<script data-pugkit-live-reload[\s\S]*?<\/script>/, '')

    expect(withoutInjection).toBe(await project.read('dist/about.html'))
  })
})

describe('src と public に同名の HTML があるとき', () => {
  /**
   * build は pug のあとに copy を走らせるので public 側が勝つ。
   * dev が Pug を優先すると「dev では自分の書いたページ、本番では public の中身」
   * という、もっとも発見が遅れる形の食い違いになる。
   */
  const publicPage = '<!DOCTYPE html><html><body><p>FROM-PUBLIC</p></body></html>\n'

  it('dev の配信内容が build の出力と一致する', async () => {
    await project.write({ 'public/about.html': publicPage })
    await build(project.root)

    const builder = await createTestBuilder(project.root, 'development')
    builder.context.config.server.port = 0
    await builder.runTask('copy')
    await builder.tasks.server(builder.context)

    const served = await (await fetch(`http://localhost:${builder.context.server.port}/about.html`)).text()

    expect(served).toContain('FROM-PUBLIC')
    expect(await project.read('dist/about.html')).toContain('FROM-PUBLIC')
  })

  it('衝突していることを警告する（黙って上書きされると気づけない）', async () => {
    await project.write({ 'public/about.html': publicPage })
    const builder = await createTestBuilder(project.root, 'development')
    const warnings = []
    const { logger } = await import('../../utils/logger.mjs')
    const original = logger.warn
    logger.warn = (label, message) => warnings.push(message)
    onTestFinished(() => {
      logger.warn = original
    })

    await builder.runTask('copy')

    expect(warnings.join('\n')).toContain('about.html')
  })

  it('衝突していなければ警告しない', async () => {
    const builder = await createTestBuilder(project.root, 'development')
    const warnings = []
    const { logger } = await import('../../utils/logger.mjs')
    const original = logger.warn
    logger.warn = (label, message) => warnings.push(message)
    onTestFinished(() => {
      logger.warn = original
    })

    await builder.runTask('copy')

    expect(warnings).toEqual([])
  })
})

describe('アセット', () => {
  it('画像・SVG・スプライト・public は dev と build でバイト一致する', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    // CSS / JS は意図的に別物、HTML は dev では書き出さないので比較対象から外す
    const target = file => !/\.(css|js|map|html)$/.test(file)
    const buildFiles = (await listFiles(project.path('dist'))).filter(target)
    const devFiles = (await listFiles(devContext.paths.outputRoot)).filter(f => target(f) && !f.startsWith('.pugkit'))

    expect(devFiles).toEqual(buildFiles)

    for (const file of buildFiles) {
      const fromBuild = await readFile(project.path(`dist/${file}`))
      const fromDev = await readFile(`${devContext.paths.outputRoot}/${file}`)

      expect(fromDev.equals(fromBuild), `${file} が食い違っている`).toBe(true)
    }
  })

  it('CSS は dev だけ非圧縮でソースマップつき', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    const buildCss = await project.read('dist/assets/css/style.css')
    const devCss = await readFile(`${devContext.paths.outputRoot}/assets/css/style.css`, 'utf8')

    expect(buildCss).not.toContain('\n')
    expect(devCss).toContain('\n')
    // 同じ内容を表しているか（圧縮の有無だけの違いか）
    expect(buildCss).toContain('color:red')
    expect(devCss).toContain('color: red')

    expect(await listFiles(project.path('dist'))).not.toContain('assets/css/style.css.map')
    expect(await listFiles(devContext.paths.outputRoot)).toContain('assets/css/style.css.map')
  })

  it('JS は build だけ console を落とす', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    expect(await project.read('dist/assets/js/main.js')).not.toContain('console.log')
    expect(await readFile(`${devContext.paths.outputRoot}/assets/js/main.js`, 'utf8')).toContain('console.log')
  })
})

describe('出力対象の一致', () => {
  it('HTML 以外のファイル構成が dev と build で同じになる', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    const buildFiles = (await listFiles(project.path('dist'))).filter(f => !f.endsWith('.html'))
    const devFiles = (await listFiles(devContext.paths.outputRoot)).filter(
      f => !f.startsWith('.pugkit') && !f.endsWith('.map')
    )

    expect(devFiles.sort()).toEqual(buildFiles.sort())
  })
})
