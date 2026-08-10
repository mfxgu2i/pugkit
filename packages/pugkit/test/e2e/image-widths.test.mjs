import { describe, expect, it, beforeEach } from 'vitest'
import { writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { build } from '../../index.mjs'
import { createTempProject, listFiles, createTestBuilder } from '../helpers/project.mjs'

/**
 * 幅記述子を build 全体で通す。
 *
 * 幅は imageInfo() の呼び出し側が決めるので、pug が集めたものを image タスクが作る。
 * BUILD_PHASES が pug を image より先に置いていることが前提になっている（docs/adr/0011）。
 * ここが production で動いていないと、HTML は幅を指しているのにファイルが 1 枚も出ない。
 */
const layout = `doctype html
html(lang='ja')
  head
    title x
  body
    block content
`

const jpeg = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .toBuffer()

let project

async function createProject(pages = {}) {
  project = await createTempProject({
    'package.json': '{"name":"widths","type":"module"}',
    'pugkit.config.mjs': 'export default {}\n',
    'src/_partials/_layout.pug': layout,
    ...pages
  })

  await mkdir(project.path('src/assets/img'), { recursive: true })
  await writeFile(project.path('src/assets/img/hero.jpg'), await jpeg(800, 600))
  await writeFile(project.path('src/assets/img/hero_sp.jpg'), await jpeg(376, 300))

  return project
}

/** HTML から srcset の候補パスを取り出す */
const srcsetCandidates = html =>
  [...html.matchAll(/srcset="([^"]+)"/g)].flatMap(([, value]) =>
    value.split(',').map(candidate => candidate.trim().split(/\s+/)[0])
  )

const widthPage = (widths, sizes = '100vw') => `extends /_partials/_layout.pug
block content
  - const info = imageInfo('/assets/img/hero.jpg', { widths: ${JSON.stringify(widths)}, sizes: '${sizes}' })
  img(src=info.src, srcset=info.srcset, sizes=info.sizes, width=info.width, height=info.height)
`

describe('幅記述子のビルド', () => {
  beforeEach(async () => {
    await createProject({ 'src/index.pug': widthPage([200, 400]) })
  })

  it('srcset の候補がすべて dist に存在する', async () => {
    await build(project.root)

    const html = await project.read('dist/index.html')
    const files = await listFiles(project.path('dist'))
    const candidates = srcsetCandidates(html)

    // 前提: 幅記述子が実際に出ている（候補が無いと以下が空振りする）
    expect(candidates.length).toBeGreaterThan(1)

    for (const candidate of candidates) {
      expect(files, `${candidate} が出力に無い`).toContain(candidate.replace(/^\//, ''))
    }
  })

  it('幅違いの寸法が記述子と一致する', async () => {
    await build(project.root)

    const { width, height } = await sharp(project.path('dist/assets/img/hero@200w.webp')).metadata()

    expect({ width, height }).toEqual({ width: 200, height: 150 })
  })

  it('sizes と原寸の width/height を HTML に書ける', async () => {
    await build(project.root)
    const html = await project.read('dist/index.html')

    expect(html).toContain('sizes="100vw"')
    expect(html).toContain('width="800"')
    expect(html).toContain('height="600"')
  })
})

describe('幅を渡さないビルド', () => {
  it('@<数字>w の出力が 1 つも出ない', async () => {
    await createProject({
      'src/index.pug': `extends /_partials/_layout.pug
block content
  - const info = imageInfo('/assets/img/hero.jpg')
  img(src=info.src, srcset=info.srcset)
`
    })

    await build(project.root)
    const files = await listFiles(project.path('dist'))

    // 前提: 画像そのものは出ている（1 枚も処理されていないと空振りする）
    expect(files).toContain('assets/img/hero.webp')
    expect(files.filter(file => /@\d+w\./.test(file))).toEqual([])
  })
})

describe('複数ページからの参照', () => {
  it('違う幅で参照されたら和集合を作る', async () => {
    await createProject({
      'src/index.pug': widthPage([200]),
      'src/about.pug': widthPage([400])
    })

    await build(project.root)
    const files = await listFiles(project.path('dist'))

    expect(files).toContain('assets/img/hero@200w.webp')
    expect(files).toContain('assets/img/hero@400w.webp')
  })
})

describe('同じプロセスで 2 回ビルドする', () => {
  /**
   * clean() が幅の要求を捨てないと、テンプレートから消した幅が出続ける。
   * index.mjs の build() は毎回新しい BuildContext を作るので、
   * ここは 1 つの Builder を使い回して確かめる
   */
  it('前回の幅を持ち越さない', async () => {
    await createProject({ 'src/index.pug': widthPage([200]) })

    const builder = await createTestBuilder(project.root, 'production')
    await builder.build()
    expect(await listFiles(project.path('dist'))).toContain('assets/img/hero@200w.webp')

    await project.write({ 'src/index.pug': widthPage([400]) })
    await builder.build()

    const files = await listFiles(project.path('dist'))
    expect(files).toContain('assets/img/hero@400w.webp')
    expect(files).not.toContain('assets/img/hero@200w.webp')
  })
})
