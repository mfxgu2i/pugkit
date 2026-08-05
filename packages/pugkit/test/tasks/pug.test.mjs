import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pugTask, buildPageHtml } from '../../tasks/pug.mjs'
import { BuildContext } from '../../core/context.mjs'
import { defaultConfig } from '../../config/defaults.mjs'

let root

function createContext(mode) {
  const config = structuredClone(defaultConfig)
  config.root = root
  return new BuildContext(config, mode)
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'pugkit-pug-test-'))
  await mkdir(resolve(root, 'src/_partials'), { recursive: true })
  await writeFile(
    resolve(root, 'src/_partials/_layout.pug'),
    `doctype html
html
  body
    block content
`
  )
  await writeFile(
    resolve(root, 'src/index.pug'),
    `extends /_partials/_layout.pug
block content
  h1 Hello
  p= Builder.url.pathname
`
  )
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('buildPageHtml', () => {
  it('should return the same html that production pugTask writes to dist', async () => {
    const prodContext = createContext('production')
    await pugTask(prodContext)
    const written = await readFile(resolve(root, 'dist/index.html'), 'utf8')

    const devContext = createContext('development')
    const built = await buildPageHtml(resolve(root, 'src/index.pug'), devContext)

    expect(built).toBe(written)
  })

  it('should record template dependencies in the graph', async () => {
    const context = createContext('development')
    const page = resolve(root, 'src/index.pug')
    await buildPageHtml(page, context)

    const affected = context.graph.getAffectedParents(resolve(root, 'src/_partials/_layout.pug'))
    expect(affected).toContain(page)
  })

  it('should cache the compiled template in development', async () => {
    const context = createContext('development')
    const page = resolve(root, 'src/index.pug')
    await buildPageHtml(page, context)
    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })

  it('should not cache the compiled template in production', async () => {
    const context = createContext('production')
    const page = resolve(root, 'src/index.pug')
    await buildPageHtml(page, context)
    expect(context.cache.getPugTemplate(page)).toBeUndefined()
  })

  it('should not record graph edges from a build invalidated mid-compile', async () => {
    const context = createContext('development')
    const page = resolve(root, 'src/index.pug')

    // ビルド開始と同時に無効化が入るケースを擬似再現:
    // getPageEpoch 取得後に invalidate される状況を、開始前に世代を進めた
    // 偽の epoch で検証するのは難しいため、invalidate を挟んで直接検証する
    const original = context.cache.getPageEpoch.bind(context.cache)
    let firstCall = true
    context.cache.getPageEpoch = filePath => {
      const epoch = original(filePath)
      if (firstCall) {
        firstCall = false
        // ビルド開始直後（epoch 取得直後）に watcher の無効化が入った状況を再現
        context.cache.invalidatePageHtml(filePath)
      }
      return epoch
    }

    await buildPageHtml(page, context)
    context.cache.getPageEpoch = original

    // 古い世代のビルド結果はテンプレートキャッシュに書き戻されない
    expect(context.cache.getPugTemplate(page)).toBeUndefined()
  })

  it('should throw on compile errors', async () => {
    await writeFile(resolve(root, 'src/broken.pug'), 'extends /_partials/_missing.pug\n')
    const context = createContext('development')
    await expect(buildPageHtml(resolve(root, 'src/broken.pug'), context)).rejects.toThrow()
    await rm(resolve(root, 'src/broken.pug'))
  })
})
