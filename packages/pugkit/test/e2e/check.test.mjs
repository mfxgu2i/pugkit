import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { check } from '../../index.mjs'
import { createTempProject, createTestBuilder } from '../helpers/project.mjs'

/**
 * build の出力をそのまま検査する。
 * check はビルドしないので、build を通した後の dist が入力になる。
 */

const targets = findings =>
  findings.filter(f => f.rule === 'missing-reference').map(f => f.message.replace('参照が見つかりません: ', ''))

describe('pugkit check', () => {
  it('CSS が変換前の画像名を指していることを build 後に見つける', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"fixture","type":"module"}',
      'pugkit.config.mjs': 'export default {}',
      'src/index.pug': [
        'doctype html',
        'html(lang="ja")',
        '  head',
        '    link(rel="stylesheet" href="/assets/css/style.css")',
        '  body',
        '    h1 home',
        '    a(href="/about/") about'
      ].join('\n'),
      // sass は url() を書き換えないので、変換後の名前を書かないと壊れる
      'src/assets/css/style.scss': [
        '.a { background-image: url(../img/hero.jpg); }',
        '.b { background-image: url(../img/hero.webp); }'
      ].join('\n')
    })

    await mkdir(project.path('src/assets/img'), { recursive: true })
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#0a0' } })
      .jpeg()
      .toFile(resolve(project.path('src/assets/img'), 'hero.jpg'))

    const builder = await createTestBuilder(project.root, 'production')
    await builder.build()

    const { findings } = await check(project.root, ['references'])

    // 検査自体が動いていることを先に固定する（変換後の名前は通る）
    expect(targets(findings)).not.toContain('../img/hero.webp')

    expect(targets(findings).sort()).toEqual(['../img/hero.jpg', '/about/'])
  })
})
