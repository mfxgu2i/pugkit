import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { build, createBuilder } from '../../index.mjs'
import { createTempProject, listFiles, minimalProjectFiles } from '../helpers/project.mjs'

/**
 * architecture.md の中核:
 *   「build はキャッシュを一切使わない / フルビルド / 毎回同じ結果を出す」
 *
 * dev 側にどんな不具合があっても build し直せば正しい出力が得られる、という
 * 前提そのものを守るためのテスト。
 */
async function checksum(dir, files) {
  const hash = createHash('md5')
  for (const file of files) {
    hash.update(file)
    hash.update(await readFile(`${dir}/${file}`))
  }
  return hash.digest('hex')
}

describe('build の再現性', () => {
  it('2回続けてビルドしても同じ出力になる', async () => {
    const project = await createTempProject(minimalProjectFiles())

    await build(project.root)
    const first = await listFiles(project.path('dist'))
    const firstSum = await checksum(project.path('dist'), first)

    await build(project.root)
    const second = await listFiles(project.path('dist'))

    expect(second).toEqual(first)
    expect(await checksum(project.path('dist'), second)).toBe(firstSum)
  })

  it('2回目もページを作り直す（変更なしでスキップしない）', async () => {
    const project = await createTempProject(minimalProjectFiles())
    await build(project.root)

    // 出力を消しても、2回目のビルドで作り直される
    await import('node:fs/promises').then(fs => fs.rm(project.path('dist/index.html')))
    await build(project.root)

    expect(await listFiles(project.path('dist'))).toContain('index.html')
  })

  it('dev のキャッシュを温めても build の出力は変わらない', async () => {
    const project = await createTempProject(minimalProjectFiles())

    await build(project.root)
    const expected = await checksum(project.path('dist'), await listFiles(project.path('dist')))

    // 同一プロセスで dev のコンテキストを作り、テンプレートキャッシュを汚す
    const devBuilder = await createBuilder(project.root, 'development')
    const { buildPageHtml } = await import('../../tasks/pug.mjs')
    await buildPageHtml(project.path('src/index.pug'), devBuilder.context)

    await build(project.root)

    expect(await checksum(project.path('dist'), await listFiles(project.path('dist')))).toBe(expected)
  })
})

describe('dev と build の出力一致', () => {
  it('dev が配信する HTML は build が書き出す HTML と一致する', async () => {
    const project = await createTempProject(minimalProjectFiles())
    await build(project.root)
    const built = await project.read('dist/index.html')

    const devBuilder = await createBuilder(project.root, 'development')
    const { buildPageHtml } = await import('../../tasks/pug.mjs')
    const served = await buildPageHtml(project.path('src/index.pug'), devBuilder.context)

    expect(served).toBe(built)
  })
})

describe('dev は build の出力先に書き込まない', () => {
  it('dev のタスクを走らせても outDir が空のまま', async () => {
    const project = await createTempProject(minimalProjectFiles())

    const devBuilder = await createBuilder(project.root, 'development')
    const { context } = devBuilder
    await devBuilder.tasks.sass(context)
    await devBuilder.tasks.script(context)

    // dev の成果物はキャッシュ側に出る
    expect(await listFiles(context.paths.outputRoot)).not.toEqual([])
    // outDir は build 専用なので触られない
    expect(await listFiles(project.path('dist'))).toEqual([])
  })

  it('build 済みの outDir を dev が汚さない', async () => {
    const project = await createTempProject(minimalProjectFiles())
    await build(project.root)
    const before = await checksum(project.path('dist'), await listFiles(project.path('dist')))

    const devBuilder = await createBuilder(project.root, 'development')
    await devBuilder.tasks.sass(devBuilder.context)
    await devBuilder.tasks.script(devBuilder.context)

    expect(await checksum(project.path('dist'), await listFiles(project.path('dist')))).toBe(before)
  })
})
