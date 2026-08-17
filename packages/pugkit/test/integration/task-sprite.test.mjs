import { describe, expect, it, beforeEach } from 'vitest'
import { rm } from 'node:fs/promises'
import { spriteTask } from '../../tasks/svg-sprite.mjs'
import { FileWatcher } from '../../core/watcher.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * SVG スプライト生成。
 * README: 「SVG ファイル名がそのまま <symbol id> になります」
 *         「fill / stroke は自動的に currentColor に変換されます」
 */
let project

const icon = (attrs = 'fill="#ff0000"', extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${extra}><path ${attrs} d="M1 1h2v2H1z"/></svg>\n`

function createContext() {
  return {
    paths: { src: project.path('src'), output: project.path('dist') },
    config: {},
    isProduction: true
  }
}

beforeEach(async () => {
  project = await createTempProject({ 'src/.keep': '' })
})

describe('symbol の id', () => {
  it('ファイル名がそのまま id になる', async () => {
    await project.write({ 'src/assets/icons/arrow-right.svg': icon() })

    await spriteTask(createContext())

    expect(await project.read('dist/assets/icons.svg')).toContain('id="arrow-right"')
  })

  // 置換文字列として扱うと $& がマッチした <svg ...> タグ全体に展開され、
  // id 属性の中に SVG タグが流れ込んでスプライト全体が不正な XML になる
  it.each([['dollar$&amp'], ['back$`tick'], ["quote$'x"], ['double$$dollar']])(
    '$ を含むファイル名 %s でも id がファイル名と一致する',
    async name => {
      await project.write({ [`src/assets/icons/${name}.svg`]: icon() })

      await spriteTask(createContext())

      const sprite = await project.read('dist/assets/icons.svg')
      expect(sprite).toContain(`id="${name}"`)
      expect(sprite).not.toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">amp')
    }
  )
})

describe('サブディレクトリ', () => {
  /**
   * icons 配下は svg タスクが丸ごと対象外にしているので、スプライトが直下しか
   * 拾わないと、サブディレクトリに置いた SVG はどちらにも入らないまま無警告で消える
   */
  it('サブディレクトリの SVG もスプライトに入る', async () => {
    await project.write({
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/social/x.svg': icon()
    })

    await spriteTask(createContext())

    const sprite = await project.read('dist/assets/icons.svg')
    expect(sprite).toContain('id="arrow"')
    expect(sprite).toContain('id="social/x"')
  })

  it('id は icons ディレクトリからの相対パスになる（同名でも衝突しない）', async () => {
    await project.write({
      'src/assets/icons/social/x.svg': icon(),
      'src/assets/icons/brand/x.svg': icon()
    })

    await spriteTask(createContext())

    const sprite = await project.read('dist/assets/icons.svg')
    expect(sprite).toContain('id="social/x"')
    expect(sprite).toContain('id="brand/x"')
  })

  it('サブディレクトリを分けてもスプライトは1つのまま', async () => {
    await project.write({
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/social/x.svg': icon()
    })

    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toEqual(['assets/icons.svg'])
  })

  // 別のスプライトにすると同じアイコンが2つのスプライトに入って出力が二重になる
  it('icons の中の icons は外側のスプライトに入る', async () => {
    await project.write({ 'src/assets/icons/icons/x.svg': icon() })

    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toEqual(['assets/icons.svg'])
    expect(await project.read('dist/assets/icons.svg')).toContain('id="icons/x"')
  })

  it('「_」始まりのサブディレクトリは対象外', async () => {
    await project.write({
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/_draft/wip.svg': icon()
    })

    await spriteTask(createContext())

    const sprite = await project.read('dist/assets/icons.svg')
    expect(sprite).toContain('id="arrow"')
    expect(sprite).not.toContain('id="_draft/wip"')
  })
})

describe('symbol の並び順', () => {
  /**
   * glob は readdir の順をそのまま返すので、並べ替えないと順序がファイルシステム
   * 任せになる。中身が同じでも環境が変わると差分が出て、原因が追いにくい
   */
  const idsOf = sprite => [...sprite.matchAll(/id="([^"]+)"/g)].map(m => m[1])

  it('id の昇順で並べる', async () => {
    await project.write({
      'src/assets/icons/user.svg': icon(),
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/menu.svg': icon()
    })

    await spriteTask(createContext())

    expect(idsOf(await project.read('dist/assets/icons.svg'))).toEqual(['arrow', 'menu', 'user'])
  })

  it('サブディレクトリを含めても並び順が決まる', async () => {
    await project.write({
      'src/assets/icons/user.svg': icon(),
      'src/assets/icons/social/x.svg': icon(),
      'src/assets/icons/brand/logo.svg': icon()
    })

    await spriteTask(createContext())

    expect(idsOf(await project.read('dist/assets/icons.svg'))).toEqual(['brand/logo', 'social/x', 'user'])
  })

  it('アイコンを足して消すと元のバイト列に戻る', async () => {
    await project.write({
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/user.svg': icon()
    })
    await spriteTask(createContext())
    const before = await project.read('dist/assets/icons.svg')

    await project.write({ 'src/assets/icons/menu.svg': icon() })
    await spriteTask(createContext())
    await rm(project.path('src/assets/icons/menu.svg'))
    await spriteTask(createContext())

    expect(await project.read('dist/assets/icons.svg')).toBe(before)
  })
})

describe('fill / stroke の変換', () => {
  it('色指定を currentColor にする', async () => {
    await project.write({ 'src/assets/icons/a.svg': icon('fill="#ff0000" stroke="#00ff00"') })

    const sprite = await (async () => {
      await spriteTask(createContext())
      return project.read('dist/assets/icons.svg')
    })()

    expect(sprite).toContain('fill="currentColor"')
    expect(sprite).toContain('stroke="currentColor"')
  })

  it('fill="none" は変換しない（塗りなしの指定が潰れる）', async () => {
    await project.write({ 'src/assets/icons/a.svg': icon('fill="none" stroke="#00ff00"') })

    await spriteTask(createContext())

    expect(await project.read('dist/assets/icons.svg')).toContain('fill="none"')
  })
})

describe('viewBox', () => {
  it('viewBox をそのまま引き継ぐ', async () => {
    await project.write({
      'src/assets/icons/a.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32"><path d="M1 1h2v2H1z"/></svg>\n'
    })

    await spriteTask(createContext())

    expect(await project.read('dist/assets/icons.svg')).toContain('viewBox="0 0 48 32"')
  })

  it('寸法情報が無ければ 0 0 24 24 にする', async () => {
    await project.write({
      'src/assets/icons/a.svg': '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1h2v2H1z"/></svg>\n'
    })

    await spriteTask(createContext())

    expect(await project.read('dist/assets/icons.svg')).toContain('viewBox="0 0 24 24"')
  })
})

describe('出力先', () => {
  it('icons ディレクトリの親に icons.svg を出す', async () => {
    await project.write({ 'src/assets/icons/a.svg': icon() })

    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toContain('assets/icons.svg')
  })

  it('別ディレクトリの同名アイコンは別のスプライトに分かれる', async () => {
    await project.write({
      'src/assets/icons/same.svg': icon(),
      'src/other/icons/same.svg': icon()
    })

    await spriteTask(createContext())

    const output = await listFiles(project.path('dist'))
    expect(output).toEqual(expect.arrayContaining(['assets/icons.svg', 'other/icons.svg']))
  })

  it('スプライトは非表示のルート svg に symbol を並べた形にする', async () => {
    await project.write({ 'src/assets/icons/a.svg': icon() })

    await spriteTask(createContext())

    const sprite = await project.read('dist/assets/icons.svg')
    expect(sprite).toContain('<svg xmlns="http://www.w3.org/2000/svg" style="display:none">')
    expect(sprite).toContain('<symbol id="a"')
    expect(sprite).toContain('</symbol>')
  })

  it('アイコンが無ければ何も出力しない', async () => {
    await project.write({ 'src/assets/icons/.keep': '' })

    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toEqual([])
  })

  it('「_」始まりのディレクトリ配下のアイコンは対象外', async () => {
    // README:「_ で始まるファイル・ディレクトリはビルド対象外」
    await project.write({
      'src/_parts/icons/hidden.svg': icon(),
      'src/assets/icons/arrow.svg': icon()
    })

    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toEqual(['assets/icons.svg'])
  })
})

describe('アイコンが無くなったとき', () => {
  /**
   * スプライトは icons ディレクトリ全体から1ファイルを作るので、
   * アイコンが減っただけなら作り直しで追随できる。
   * だが0件になると生成自体が行われず、古いスプライトが残って配信され続ける
   * （消したアイコンを参照する <use> が解決してしまい、エラーにもならない）。
   */
  it('最後のアイコンを消したら古いスプライトも消す', async () => {
    await project.write({ 'src/assets/icons/star.svg': icon() })
    await spriteTask(createContext())
    expect(await listFiles(project.path('dist'))).toContain('assets/icons.svg')

    await rm(project.path('src/assets/icons/star.svg'))
    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).not.toContain('assets/icons.svg')
  })

  // ディレクトリごと消えると glob から見えなくなり、タスクだけでは後始末できない。
  // 監視側は「消えたファイル」を知っているので、そこから辿る
  it('icons ディレクトリごと消えても古いスプライトを消す', async () => {
    await project.write({ 'src/assets/icons/star.svg': icon() })
    const context = createContext()
    await spriteTask(context)

    const watcher = new FileWatcher(context, () => spriteTask(context))
    await rm(project.path('src/assets/icons'), { recursive: true })
    await watcher.onSpriteChange(project.path('src/assets/icons/star.svg'), 'unlink')

    expect(await listFiles(project.path('dist'))).not.toContain('assets/icons.svg')
  })

  // 消えたファイルの親を見ると、サブディレクトリが消えただけでスプライトを消してしまう
  it('サブディレクトリだけ消えても、残ったアイコンのスプライトは消さない', async () => {
    await project.write({
      'src/assets/icons/arrow.svg': icon(),
      'src/assets/icons/social/x.svg': icon()
    })
    const context = createContext()
    await spriteTask(context)

    const watcher = new FileWatcher(context, () => spriteTask(context))
    await rm(project.path('src/assets/icons/social'), { recursive: true })
    await watcher.onSpriteChange(project.path('src/assets/icons/social/x.svg'), 'unlink')

    expect(await listFiles(project.path('dist'))).toContain('assets/icons.svg')
    expect(await project.read('dist/assets/icons.svg')).not.toContain('id="social/x"')
  })

  it('他のディレクトリのスプライトには触れない', async () => {
    await project.write({
      'src/assets/icons/star.svg': icon(),
      'src/other/icons/moon.svg': icon()
    })
    await spriteTask(createContext())

    await rm(project.path('src/assets/icons/star.svg'))
    await spriteTask(createContext())

    expect(await listFiles(project.path('dist'))).toEqual(['other/icons.svg'])
  })
})
