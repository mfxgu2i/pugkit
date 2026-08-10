import { describe, expect, it, beforeEach, vi } from 'vitest'
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
    paths: { src, public: project.path('public'), output: project.path('dist') },
    config: { build: { image: { format: 'webp', sourceDensity: 2 } } },
    cache: new CacheManager('development'),
    graph: new DependencyGraph(),
    imageGraph: new DependencyGraph(),
    sassGraph: new DependencyGraph(),
    scriptGraph: new DependencyGraph(),
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

describe('ファイルの分類', () => {
  // 判定の順序そのものが仕様。順序が入れ替わると、
  // 対象のはずのファイルが無視されたり、その逆が起きる
  it.each([
    ['index.pug', 'pug'],
    ['assets/css/style.scss', 'sass'],
    ['assets/js/main.js', 'script'],
    ['assets/js/types.d.ts', null],
    ['assets/icons/arrow.svg', 'sprite'],
    ['assets/logo.svg', 'svg'],
    ['assets/img/hero.jpg', 'image'],
    ['assets/img/hero.PNG', 'image'],
    ['README.md', null]
  ])('%s は %s', (relativePath, expected) => {
    expect(watcher.classify(at(relativePath))).toBe(expected)
  })

  it('public 配下は拡張子によらず public として扱う', () => {
    expect(watcher.classify(`${context.paths.public}/ogp.jpg`)).toBe('public')
    expect(watcher.classify(`${context.paths.public}/index.html`)).toBe('public')
  })

  it('「_」始まりのアセットは対象外', () => {
    expect(watcher.classify(at('assets/img/_wip/draft.png'))).toBeNull()
    expect(watcher.classify(at('_drafts/logo.svg'))).toBeNull()
  })

  it('「_」始まりでもスプライト対象のアイコンは拾う', () => {
    // 判定順が入れ替わると、_ を含むパス配下の icons が無視される
    expect(watcher.classify(at('_shared/icons/arrow.svg'))).toBe('sprite')
  })

  it('「_」始まりでも Pug とスタイルは拾う（パーシャルとして依存解決に必要）', () => {
    expect(watcher.classify(at('_partials/_layout.pug'))).toBe('pug')
    expect(watcher.classify(at('assets/css/_vars.scss'))).toBe('sass')
  })
})

describe('Pug に include されたファイルの変更', () => {
  /**
   * include は .pug 以外も受け付け、中身をテンプレートに焼き込む
   * （クリティカル CSS のインライン化、インライン JS、データファイルなど）。
   * 焼き込まれている以上、変更されたらテンプレートごと作り直す必要がある。
   *
   * 依存は graph に登録されているのに、アセットとしての種別だけで
   * 反応を決めると、この経路が丸ごと抜け落ちて HTML が永久に古いままになる。
   */
  const embed = (page, dependency) => {
    cachePage(page)
    context.graph.addDependency(page, dependency)
  }

  it.each([
    ['assets/css/critical.css', 'スタイル'],
    ['_data/nav.txt', 'テキスト'],
    ['_data/site.json', 'JSON']
  ])('アセットとして対象外の %s でもテンプレートを無効化する', (relativePath, _label) => {
    const page = at('index.pug')
    embed(page, at(relativePath))

    watcher.handle('change', at(relativePath))

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    expect(context.cache.getPageHtml(page)).toBeUndefined()
  })

  it('リロードを通知する', () => {
    embed(at('index.pug'), at('_data/nav.txt'))

    watcher.handle('change', at('_data/nav.txt'))

    expect(context.server.reloads).toEqual(['html'])
  })

  it('埋め込まれていないファイルには反応しない', () => {
    const page = at('index.pug')
    cachePage(page)

    watcher.handle('change', at('README.md'))

    expect(context.cache.getPageHtml(page)).toBe('<html></html>')
    expect(context.server.reloads).toEqual([])
  })

  it('スクリプトとして扱われるファイルでも無効化する', async () => {
    // .js は esbuild の対象でもあるが、include で焼き込まれている分は別に無効化が要る
    const page = at('index.pug')
    embed(page, at('assets/js/inline.js'))

    await watcher.handle('change', at('assets/js/inline.js'))

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
  })

  it('Sass として扱われるファイルでは CSS の差し替えに加えてリロードも通知する', async () => {
    const page = at('index.pug')
    embed(page, at('assets/css/inline.scss'))

    await watcher.handle('change', at('assets/css/inline.scss'))

    expect(context.cache.getPugTemplate(page)).toBeUndefined()
    // CSS の差し替えだけでは焼き込まれた分が古いままになる
    expect(context.server.reloads).toEqual(['html'])
  })
})

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

  /**
   * 1 ソースが複数の密度を生むので、削除側も全部消せないと
   * 「消したはずの画像が配信され続ける」状態になる
   */
  it('画像削除で密度違いの出力もすべて消す', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    await mkdir(resolve(context.paths.output, 'assets'), { recursive: true })
    await writeFile(resolve(context.paths.output, 'assets/hero.webp'), 'x')
    await writeFile(resolve(context.paths.output, 'assets/hero@half.webp'), 'x')

    await watcher.onImageUnlink(at('assets/hero.jpg'))

    expect(existsSync(resolve(context.paths.output, 'assets/hero.webp'))).toBe(false)
    expect(existsSync(resolve(context.paths.output, 'assets/hero@half.webp'))).toBe(false)
  })

  /**
   * 幅違いは相対パスから列挙できないので、出力ディレクトリを見て消す。
   * 判定が緩いと隣の画像の出力を巻き添えにするため、消えないことも一緒に確かめる
   */
  it('画像削除で幅違いの出力も消す', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    await mkdir(resolve(context.paths.output, 'assets'), { recursive: true })
    for (const name of ['hero.webp', 'hero@400w.webp', 'hero@1200w.webp']) {
      await writeFile(resolve(context.paths.output, `assets/${name}`), 'x')
    }

    await watcher.onImageUnlink(at('assets/hero.jpg'))

    expect(existsSync(resolve(context.paths.output, 'assets/hero@400w.webp'))).toBe(false)
    expect(existsSync(resolve(context.paths.output, 'assets/hero@1200w.webp'))).toBe(false)
  })

  /**
   * 幹の前方一致で判定すると hero2 や hero_sp を巻き添えにする。
   * 拡張子を見ないと、compress モードで共存する同名別形式の出力を消す
   */
  it('名前が前置きになっているだけの画像は消さない', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    await mkdir(resolve(context.paths.output, 'assets'), { recursive: true })
    const kept = ['hero2@400w.webp', 'hero_sp@400w.webp', 'hero@400w.png', 'hero@halfw.webp']
    for (const name of ['hero@400w.webp', ...kept]) {
      await writeFile(resolve(context.paths.output, `assets/${name}`), 'x')
    }

    await watcher.onImageUnlink(at('assets/hero.jpg'))

    // 前提: 自分の幅違いは消えている
    expect(existsSync(resolve(context.paths.output, 'assets/hero@400w.webp'))).toBe(false)
    for (const name of kept) {
      expect(existsSync(resolve(context.paths.output, `assets/${name}`)), `${name} が消えている`).toBe(true)
    }
  })

  /**
   * dev は幅違いをリクエスト時に作り、既にあれば作り直さない。
   * 元画像を編集したときに消しておかないと、古い中身が配信され続ける
   */
  it('元画像の変更でも幅違いを消す', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    await mkdir(resolve(context.paths.output, 'assets'), { recursive: true })
    await writeFile(resolve(context.paths.output, 'assets/hero@400w.webp'), 'x')
    await writeFile(resolve(context.paths.output, 'assets/hero2@400w.webp'), 'x')

    await watcher.onImageChange(at('assets/hero.jpg'), 'change')

    expect(existsSync(resolve(context.paths.output, 'assets/hero@400w.webp'))).toBe(false)
    // 隣の画像は巻き添えにしない
    expect(existsSync(resolve(context.paths.output, 'assets/hero2@400w.webp'))).toBe(true)
  })

  /** glob を使うと `a{1,2}@*w.webp` が a1 と a2 に当たり、自分のを残して他人のを消す */
  it('glob のメタ文字を含む名前でも自分の幅違いだけを消す', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')

    await mkdir(resolve(context.paths.output, 'assets'), { recursive: true })
    for (const name of ['a{1,2}@400w.webp', 'a1@400w.webp', 'a2@400w.webp']) {
      await writeFile(resolve(context.paths.output, `assets/${name}`), 'x')
    }

    await watcher.onImageUnlink(at('assets/a{1,2}.jpg'))

    expect(existsSync(resolve(context.paths.output, 'assets/a{1,2}@400w.webp'))).toBe(false)
    expect(existsSync(resolve(context.paths.output, 'assets/a1@400w.webp'))).toBe(true)
    expect(existsSync(resolve(context.paths.output, 'assets/a2@400w.webp'))).toBe(true)
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

/**
 * 再生成の共通経路（rebuild）。
 *
 * 種別ごとの差分は REBUILD_SPECS の表に持たせている。表の書き間違いは
 * 「走るタスクが違う」「ログの名前が違う」という形で出るが、どちらも
 * 例外にならないので、ここで固定しないと気づけない。
 */
describe('アセットの再生成', () => {
  /** 呼ばれたタスク名と options を記録する */
  function createRunTaskSpy(behavior = () => Promise.resolve()) {
    const calls = []
    const runTask = (name, options) => {
      calls.push({ name, options })
      return behavior(name)
    }
    return { calls, runTask }
  }

  it.each([
    ['onSassChange', 'sass', at('assets/css/style.scss')],
    ['onScriptChange', 'script', at('assets/js/main.js')],
    ['onSvgChange', 'svg', at('assets/img/logo.svg')],
    ['onImageChange', 'image', at('assets/img/hero.jpg')]
  ])('%s は %s タスクに変更ファイルを渡す', async (handler, task, filePath) => {
    const spy = createRunTaskSpy()
    watcher = new FileWatcher(context, spy.runTask)

    await watcher[handler](filePath, 'change')

    expect(spy.calls).toEqual([{ name: task, options: { changed: filePath } }])
  })

  it('スプライトは変更ファイルを渡さず全体を作り直す', async () => {
    const spy = createRunTaskSpy()
    watcher = new FileWatcher(context, spy.runTask)

    await watcher.onSpriteChange(at('assets/icons/arrow.svg'), 'change')

    expect(spy.calls).toEqual([{ name: 'sprite', options: undefined }])
  })

  it('public の変更は copy タスクを走らせる', async () => {
    const spy = createRunTaskSpy()
    watcher = new FileWatcher(context, spy.runTask)
    const filePath = `${context.paths.public}/robots.txt`

    await watcher.onPublicChange(filePath, 'change')

    expect(spy.calls).toEqual([{ name: 'copy', options: { changed: filePath } }])
  })

  /**
   * 1つのアセットが壊れても dev サーバーと他のアセットは動かし続ける。
   * ここで投げると watcher のイベントハンドラが未処理の rejection になり、
   * 「保存したら dev が落ちた」という直しようのない状態になる
   */
  it('タスクが失敗しても投げず、後処理も走らせない', async () => {
    const spy = createRunTaskSpy(() => Promise.reject(new Error('boom')))
    watcher = new FileWatcher(context, spy.runTask)

    await expect(watcher.onImageChange(at('assets/img/hero.jpg'), 'change')).resolves.toBeUndefined()
    expect(context.server.reloads).toEqual([])
  })

  it('Sass が失敗したら CSS の差し替えも通知しない', async () => {
    const spy = createRunTaskSpy(() => Promise.reject(new Error('boom')))
    watcher = new FileWatcher(context, spy.runTask)

    await watcher.onSassChange(at('assets/css/style.scss'))

    expect(context.server.cssUpdates).toBe(0)
  })
})

/**
 * 再生成のログ文言。
 *
 * 種別名（REBUILD_SPECS のキー）はデータ構造の識別子であると同時に、
 * そのまま利用者のターミナルに出る（`image: assets/img/hero.jpg`）。
 * キーをリネームすると表示が黙って変わるので、ここで固定して気づけるようにする。
 * label も同じで、書き間違えても例外にならない。
 */
describe('再生成のログ', () => {
  const cases = [
    { handler: 'onSassChange', kind: 'sass', label: 'Sass build', file: () => at('assets/css/style.scss') },
    { handler: 'onScriptChange', kind: 'script', label: 'Script build', file: () => at('assets/js/main.js') },
    { handler: 'onSvgChange', kind: 'svg', label: 'SVG processing', file: () => at('assets/img/logo.svg') },
    { handler: 'onImageChange', kind: 'image', label: 'Image processing', file: () => at('assets/img/hero.jpg') },
    { handler: 'onSpriteChange', kind: 'sprite', label: 'Sprite generation', file: () => at('assets/icons/a.svg') },
    { handler: 'onPublicChange', kind: 'public', label: 'Copy', file: () => `${context.paths.public}/robots.txt` }
  ]

  /** 出力先の基準は public だけ違う。ログに出る相対パスもそれに従う */
  const relOf = ({ kind, file }) =>
    file().slice((kind === 'public' ? context.paths.public : context.paths.src).length + 1)

  it.each(cases)('$kind: 変更したファイルを種別名つきで出す', async testCase => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    watcher = new FileWatcher(context, () => Promise.resolve())

    await watcher[testCase.handler](testCase.file(), 'change')
    const lines = log.mock.calls.map(args => args.join(' '))
    log.mockRestore()

    expect(lines.some(line => line.includes(`${testCase.kind}: ${relOf(testCase)}`))).toBe(true)
  })

  it.each(cases)('$kind: 失敗は "$label failed" として出す', async testCase => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    watcher = new FileWatcher(context, () => Promise.reject(new Error('boom')))

    await watcher[testCase.handler](testCase.file(), 'change')
    const lines = error.mock.calls.map(args => args.join(' '))
    vi.restoreAllMocks()

    expect(lines.some(line => line.includes(`${testCase.label} failed: boom`))).toBe(true)
  })
})
