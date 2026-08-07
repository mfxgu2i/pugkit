import { describe, expect, it, beforeEach, onTestFinished } from 'vitest'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { build, createBuilder } from '../../index.mjs'
import { buildPageHtml } from '../../tasks/pug.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

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
    'src/assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20"/></svg>\n',
    'public/robots.txt': 'User-agent: *\n',
    ...overrides
  })

  // 画像の寸法は HTML に焼き込まれるので、dev/build で同じ値になるか確かめる材料にする
  const jpeg = (w, h) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer()
  const { writeFile, mkdir } = await import('node:fs/promises')
  await mkdir(project.path('src/assets/img'), { recursive: true })
  // 寸法は imageSize()/imageInfo() を呼んだときだけ HTML に焼き込まれる。
  // dev だけが imageGraph を作るので、ここが dev/build で食い違いやすい
  await project.write({
    'src/_partials/_mixins.pug': `mixin figure
  - const info = imageInfo('/assets/img/hero.jpg')
  img(src=info.src, width=info.width, height=info.height)
  if info.retina
    img(src=info.retina.src, width=info.retina.width)
`
  })
  await writeFile(project.path('src/assets/img/hero.jpg'), await jpeg(400, 300))
  await writeFile(project.path('src/assets/img/hero@2x.jpg'), await jpeg(800, 600))
  await writeFile(project.path('src/assets/img/hero_sp.jpg'), await jpeg(200, 150))

  return project
}

/** dev の初期タスク（Pug 以外）を build と同じ材料から走らせる */
async function runDevAssets(project) {
  const builder = await createBuilder(project.root, 'development')
  builder.context.config.server.port = 0
  const { context } = builder

  for (const name of ['sass', 'script', 'image', 'svg', 'sprite', 'copy']) {
    await context.taskRegistry[name](context)
  }

  return context
}

let project

beforeEach(async () => {
  project = await createProject({
    'src/_partials/_layout.pug': layout.replace(
      'block content',
      "include /_partials/_mixins.pug\n    block content"
    )
  })
})

describe('HTML', () => {
  it('すべてのページで dev の配信内容と build の出力が一致する', async () => {
    await build(project.root)

    const devContext = (await createBuilder(project.root, 'development')).context
    const pages = ['index.pug', 'about.pug', 'blog/index.pug', 'blog/deep/nested.pug']

    for (const relativePath of pages) {
      const served = await buildPageHtml(project.path(`src/${relativePath}`), devContext)
      const built = await project.read(`dist/${relativePath.replace(/\.pug$/, '.html')}`)

      expect(served, `${relativePath} が食い違っている`).toBe(built)
    }
  })

  it('画像の寸法が dev と build で同じ値になる', async () => {
    await build(project.root)
    const built = await project.read('dist/index.html')

    const devContext = (await createBuilder(project.root, 'development')).context
    const served = await buildPageHtml(project.path('src/index.pug'), devContext)

    // 幅・高さが焼き込まれていること自体も確認する（両方とも空なら一致してしまう）
    expect(built).toMatch(/width="400"/)
    expect(served).toBe(built)
  })

  it('subdir を設定しても一致する', async () => {
    await project.write({
      'pugkit.config.mjs': "export default { siteUrl: 'https://example.com/', subdir: 'sub' }\n"
    })
    await build(project.root)

    const devContext = (await createBuilder(project.root, 'development')).context
    const served = await buildPageHtml(project.path('src/blog/index.pug'), devContext)

    expect(served).toBe(await project.read('dist/sub/blog/index.html'))
  })

  it('dev サーバー越しでも（注入分を除けば）build と一致する', async () => {
    await build(project.root)

    const builder = await createBuilder(project.root, 'development')
    builder.context.config.server.port = 0
    await builder.tasks.server(builder.context)
    onTestFinished(() => builder.context.server.close())

    const res = await fetch(`http://localhost:${builder.context.server.port}/about.html`)
    const html = await res.text()
    const withoutInjection = html.replace(/<script>\n\(function\(\)[\s\S]*?<\/script>(?=<\/body>)/, '')

    expect(withoutInjection).toBe(await project.read('dist/about.html'))
  })
})

describe('アセット', () => {
  it('画像・SVG・スプライト・public は dev と build でバイト一致する', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    // CSS / JS は意図的に別物、HTML は dev では書き出さないので比較対象から外す
    const target = file => !/\.(css|js|map|html)$/.test(file)
    const buildFiles = (await listFiles(project.path('dist'))).filter(target)
    const devFiles = (await listFiles(devContext.paths.outDir)).filter(f => target(f) && !f.startsWith('.pugkit'))

    expect(devFiles).toEqual(buildFiles)

    for (const file of buildFiles) {
      const fromBuild = await readFile(project.path(`dist/${file}`))
      const fromDev = await readFile(`${devContext.paths.outDir}/${file}`)

      expect(fromDev.equals(fromBuild), `${file} が食い違っている`).toBe(true)
    }
  })

  it('CSS は dev だけ非圧縮でソースマップつき', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    const buildCss = await project.read('dist/assets/css/style.css')
    const devCss = await readFile(`${devContext.paths.outDir}/assets/css/style.css`, 'utf8')

    expect(buildCss).not.toContain('\n')
    expect(devCss).toContain('\n')
    // 同じ内容を表しているか（圧縮の有無だけの違いか）
    expect(buildCss).toContain('color:red')
    expect(devCss).toContain('color: red')

    expect(await listFiles(project.path('dist'))).not.toContain('assets/css/style.css.map')
    expect(await listFiles(devContext.paths.outDir)).toContain('assets/css/style.css.map')
  })

  it('JS は build だけ console を落とす', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    expect(await project.read('dist/assets/js/main.js')).not.toContain('console.log')
    expect(await readFile(`${devContext.paths.outDir}/assets/js/main.js`, 'utf8')).toContain('console.log')
  })
})

describe('出力対象の一致', () => {
  it('HTML 以外のファイル構成が dev と build で同じになる', async () => {
    await build(project.root)
    const devContext = await runDevAssets(project)

    const buildFiles = (await listFiles(project.path('dist'))).filter(f => !f.endsWith('.html'))
    const devFiles = (await listFiles(devContext.paths.outDir)).filter(
      f => !f.startsWith('.pugkit') && !f.endsWith('.map')
    )

    expect(devFiles.sort()).toEqual(buildFiles.sort())
  })
})
