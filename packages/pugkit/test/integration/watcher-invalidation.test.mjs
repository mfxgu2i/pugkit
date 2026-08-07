import { describe, expect, it, beforeEach } from 'vitest'
import { FileWatcher } from '../../core/watcher.mjs'
import { CacheManager } from '../../core/cache.mjs'
import { DependencyGraph } from '../../core/graph.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * dev のファイル変更検知は「キャッシュ無効化 + リロード通知」だけを行い、
 * ビルドはリクエスト時まで遅延する。ここではその無効化範囲と通知の種類を固定する。
 *
 * 出力先の削除を伴うハンドラがあるため実在する一時プロジェクトを使う
 * （実在しないパスを渡すと、そのパスがある環境で実ファイルを消してしまう）。
 */
let context
let watcher
let src

beforeEach(async () => {
  const project = await createTempProject({ 'src/.keep': '', 'public/.keep': '', 'dist/.keep': '' })
  src = project.path('src')
  context = {
    paths: { src, public: project.path('public'), dist: project.path('dist') },
    config: { build: { imageOptimization: 'webp' } },
    cache: new CacheManager('development'),
    graph: new DependencyGraph(),
    imageGraph: new DependencyGraph(),
    sassGraph: new DependencyGraph(),
    scriptGraph: new DependencyGraph(),
    taskRegistry: {},
    server: createServerSpy(),
    isDevelopment: true,
    isProduction: false
  }
  watcher = new FileWatcher(context)
})

/** reload に渡された kind を記録するスパイ */
function createServerSpy() {
  return {
    reloads: [],
    cssUpdates: 0,
    reload(kind) {
      this.reloads.push(kind)
    },
    reloadCSS() {
      this.cssUpdates++
    }
  }
}

const at = relativePath => `${src}/${relativePath}`

function cachePage(page) {
  context.cache.setPugTemplate(page, () => 'html')
  context.cache.setPageHtml(page, '<html></html>')
}

describe('Pug の変更', () => {
  it('ページ自身のキャッシュを無効化する', () => {
    const page = at('index.pug')
    cachePage(page)

    watcher.onPugChange(page)

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('パーシャル変更で影響を受ける親ページを無効化する', () => {
    const page = at('index.pug')
    const partial = at('_partials/_layout.pug')
    cachePage(page)
    context.graph.addDependency(page, partial)

    watcher.onPugChange(partial)

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('関係のないページには触れない', () => {
    const page = at('index.pug')
    const other = at('other.pug')
    const partial = at('_partials/_layout.pug')
    cachePage(page)
    cachePage(other)
    context.graph.addDependency(page, partial)

    watcher.onPugChange(partial)

    expect(context.cache.getPageHtml(other)).toBe('<html></html>')
  })

  it('パーシャルの入れ子をたどって連鎖的に無効化する', () => {
    const page = at('index.pug')
    const partial = at('_partials/_layout.pug')
    const inner = at('_partials/_button.pug')
    cachePage(page)
    context.graph.addDependency(page, partial)
    context.graph.addDependency(partial, inner)

    watcher.onPugChange(inner)

    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('パーシャル削除では依存を消す前に親を無効化する', async () => {
    const page = at('index.pug')
    const partial = at('_partials/_layout.pug')
    cachePage(page)
    context.graph.addDependency(page, partial)

    await watcher.onPugUnlink(partial)

    // 依存を消してから親を探すと逆引きが失われて取得できない
    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.graph.getAffectedParents(partial)).toEqual([])
  })
})

describe('画像の変更', () => {
  it('参照しているページの HTML だけ無効化しテンプレートは残す', async () => {
    const page = at('index.pug')
    const other = at('other.pug')
    const image = at('assets/hero.jpg')
    cachePage(page)
    cachePage(other)
    context.imageGraph.addDependency(page, image)

    await watcher.onImageChange(image, 'change')

    // 画像の寸法は HTML に焼き込まれるがテンプレートには含まれないため再レンダーで足りる
    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.cache.getPugTemplate(page)).toBeDefined()
    expect(context.cache.getPageHtml(other)).toBe('<html></html>')
  })

  it('参照が無い画像の変更では何も無効化しない', async () => {
    const page = at('index.pug')
    cachePage(page)

    await watcher.onImageChange(at('assets/hero.jpg'), 'change')

    expect(context.cache.getPageHtml(page)).toBe('<html></html>')
  })

  it('参照が無い画像の追加では全ページ HTML を無効化する', async () => {
    const page = at('index.pug')
    cachePage(page)

    // 「まだ存在しない画像」を参照していたページは imageGraph にエッジを持てないため、
    // 追加時は安全側に倒して全ページを作り直させる
    await watcher.onImageChange(at('assets/hero.jpg'), 'add')

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })

  it('画像削除で参照ページを無効化する', async () => {
    const page = at('index.pug')
    const image = at('assets/hero.jpg')
    cachePage(page)
    context.imageGraph.addDependency(page, image)

    await watcher.onImageUnlink(image)

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.imageGraph.getAffectedParents(image)).toEqual([])
  })
})

describe('SVG の変更', () => {
  it('include で埋め込まれた SVG はテンプレートごと無効化する', async () => {
    const page = at('index.pug')
    const svg = at('assets/logo.svg')
    cachePage(page)
    context.graph.addDependency(page, svg)

    await watcher.onSvgChange(svg, 'change')

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('寸法参照だけの SVG は HTML のみ無効化する', async () => {
    const page = at('index.pug')
    const svg = at('assets/logo.svg')
    cachePage(page)
    context.imageGraph.addDependency(page, svg)

    await watcher.onSvgChange(svg, 'change')

    expect(context.cache.getPageHtml(page)).toBeUndefined()
    expect(context.cache.getPugTemplate(page)).toBeDefined()
  })
})

describe('リロード通知の種類', () => {
  // 'html' はブラウザが DOM 差分適用で反映できる変更、
  // 'full' は HTML 以外のリソースを取り直す必要がある変更
  it('Pug の変更は html', () => {
    watcher.onPugChange(at('index.pug'))
    expect(context.server.reloads).toEqual(['html'])
  })

  it('パーシャル削除は html', async () => {
    await watcher.onPugUnlink(at('_partials/_layout.pug'))
    expect(context.server.reloads).toEqual(['html'])
  })

  it('ページ削除は full', async () => {
    await watcher.onPugUnlink(at('index.pug'))
    expect(context.server.reloads).toEqual(['full'])
  })

  it('画像の変更は full', async () => {
    await watcher.onImageChange(at('assets/hero.jpg'), 'change')
    expect(context.server.reloads).toEqual(['full'])
  })

  it('SVG の変更は full', async () => {
    await watcher.onSvgChange(at('assets/logo.svg'), 'change')
    expect(context.server.reloads).toEqual(['full'])
  })

  it('スプライト対象アイコンの変更は full', async () => {
    await watcher.onSpriteChange(at('assets/icons/arrow.svg'), 'change')
    expect(context.server.reloads).toEqual(['full'])
  })

  it('スクリプトの変更は full', async () => {
    await watcher.onScriptChange(at('assets/js/main.js'))
    expect(context.server.reloads).toEqual(['full'])
  })

  it('public の変更は full', async () => {
    await watcher.onPublicChange(`${context.paths.public}/robots.txt`, 'change')
    expect(context.server.reloads).toEqual(['full'])
  })

  it('Sass の変更はリロードせず CSS だけ差し替える', async () => {
    await watcher.onSassChange(at('assets/css/style.scss'))
    expect(context.server.reloads).toEqual([])
    expect(context.server.cssUpdates).toBe(1)
  })
})
