import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { check } from '../../index.mjs'
import { createTempProject, createTestBuilder } from '../helpers/project.mjs'

/**
 * ルート相対で書いた画像が subdir 付きの案件でも本番で届くことを、build の出力で固定する。
 *
 * imageInfo が返す src はそのまま HTML に載る。src 直下として解くと、
 * 実ファイルは見つかるので警告も出ず、寸法も付いたまま subdir の抜けた URL が出る。
 * 本番に上げるまで気づけない壊れ方なので、check まで通して確かめる（docs/adr/0015）。
 */

const page = `doctype html
html(lang='ja')
  head
    title x
  body
    - const info = imageInfo(\`\${Builder.subdir}/assets/img/hero.jpg\`)
    img(src=info.src, srcset=info.srcset, width=info.width, height=info.height, alt='')
`

async function buildWithSubdir(subdir) {
  const project = await createTempProject({
    'package.json': '{"name":"root-relative","type":"module"}',
    'pugkit.config.mjs': `export default { subdir: '${subdir}' }\n`,
    'src/index.pug': page
  })

  await mkdir(project.path('src/assets/img'), { recursive: true })
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .jpeg()
    .toFile(project.path('src/assets/img/hero.jpg'))

  const builder = await createTestBuilder(project.root, 'production')
  await builder.build()

  return project
}

describe('ルート相対で書いた画像', () => {
  it('subdir 付きでも URL・寸法・実ファイルがそろう', async () => {
    const project = await buildWithSubdir('sub')
    const html = await project.read('dist/sub/index.html')

    expect(html).toContain('src="/sub/assets/img/hero@half.webp"')
    expect(html).toContain('srcset="/sub/assets/img/hero@half.webp 1x, /sub/assets/img/hero.webp 2x"')
    expect(html).toContain('width="400"')
    expect(html).toContain('height="300"')

    const { findings } = await check(project.root, ['references'])
    expect(findings.filter(f => f.rule === 'missing-reference')).toEqual([])
  })

  it('subdir が空なら前置きも付かない', async () => {
    const project = await buildWithSubdir('')
    const html = await project.read('dist/index.html')

    expect(html).toContain('src="/assets/img/hero@half.webp"')

    const { findings } = await check(project.root, ['references'])
    expect(findings.filter(f => f.rule === 'missing-reference')).toEqual([])
  })
})
