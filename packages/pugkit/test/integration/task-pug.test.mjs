import { describe, expect, it, beforeEach } from 'vitest'
import { buildPageHtml, pugTask } from '../../tasks/pug.mjs'
import { BuildContext } from '../../core/context.mjs'
import { defaultConfig } from '../../config/defaults.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * ページ1枚のレンダリング。dev の遅延ビルドと production のフルビルドが共用する。
 */
let project

function createContext(mode) {
  const config = structuredClone(defaultConfig)
  config.root = project.root
  return new BuildContext(config, mode)
}

beforeEach(async () => {
  project = await createTempProject({
    'src/_partials/_layout.pug': 'doctype html\nhtml\n  body\n    block content\n',
    'src/index.pug': 'extends /_partials/_layout.pug\nblock content\n  h1 Hello\n  p= Builder.url.pathname\n'
  })
})

describe('buildPageHtml', () => {
  it('dev が返す HTML は production が書き出す HTML と一致する', async () => {
    await pugTask(createContext('production'))
    const written = await project.read('dist/index.html')

    const built = await buildPageHtml(project.path('src/index.pug'), createContext('development'))

    expect(built).toBe(written)
  })

  it('テンプレートの依存関係をグラフに記録する', async () => {
    const context = createContext('development')
    const page = project.path('src/index.pug')
    await buildPageHtml(page, context)

    expect(context.graph.getAffectedParents(project.path('src/_partials/_layout.pug'))).toContain(page)
  })

  it('dev ではコンパイル済みテンプレートをキャッシュする', async () => {
    const context = createContext('development')
    const page = project.path('src/index.pug')
    await buildPageHtml(page, context)

    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })

  it('production ではテンプレートをキャッシュしない', async () => {
    const context = createContext('production')
    const page = project.path('src/index.pug')
    await buildPageHtml(page, context)

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
  })

  it('コンパイルエラーは投げる', async () => {
    await project.write({ 'src/broken.pug': 'extends /_partials/_missing.pug\n' })

    await expect(buildPageHtml(project.path('src/broken.pug'), createContext('development'))).rejects.toThrow()
  })

  // ビルド中に変更が入ったら、古いソースから作った結果は
  // キャッシュにもグラフにも残してはいけない（残ると次の無効化で拾えなくなる）
  it('ビルド中に無効化されたらテンプレートを保存しない', async () => {
    const context = createContext('development')
    const page = project.path('src/index.pug')

    const pending = buildPageHtml(page, context)
    context.cache.invalidatePageHtml(page)
    await pending

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
  })

  it('ビルド中に無効化されたら依存グラフを書き換えない', async () => {
    const context = createContext('development')
    const page = project.path('src/index.pug')
    const partial = project.path('src/_partials/_layout.pug')

    const pending = buildPageHtml(page, context)
    context.cache.invalidatePageHtml(page)
    await pending

    expect(context.graph.getAffectedParents(partial)).toEqual([])
  })
})

describe('pugTask', () => {
  it('アンダースコア始まりのファイルはページとして出力しない', async () => {
    await project.write({ 'src/_draft.pug': 'p draft\n' })

    await pugTask(createContext('production'))

    const output = await listFiles(project.path('dist'))
    expect(output).toContain('index.html')
    expect(output).not.toContain('_draft.html')
  })

  it('watcher から名指しされてもアンダースコア始まりは出力しない', async () => {
    await project.write({ 'src/_draft.pug': 'p draft\n' })
    const context = createContext('production')

    // パーシャル変更時、watcher は影響ページと一緒にパーシャル自身も渡してくる
    await pugTask(context, { files: [project.path('src/_draft.pug'), project.path('src/index.pug')] })

    const output = await listFiles(project.path('dist'))
    expect(output).toContain('index.html')
    expect(output).not.toContain('_draft.html')
  })
})
