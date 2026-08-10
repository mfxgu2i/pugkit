import { describe, expect, it, onTestFinished } from 'vitest'
import { readFile } from 'node:fs/promises'
import { sassTask } from '../../tasks/sass.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'
import { DependencyGraph } from '../../core/graph.mjs'
import { ResourceStore } from '../../core/resources.mjs'

/**
 * Sass の後段。Lightning CSS がベンダープレフィックス・モダン構文の降格・圧縮を担う。
 *
 * 見るのは「その設定で出た CSS が要件を満たすか」で、圧縮アルゴリズムの中身ではない。
 * 対象ブラウザで動かない構文が素通りすると、本番でだけ効かないスタイルになる。
 */
async function run(files, mode = 'production') {
  const project = await createTempProject(files)
  const isProduction = mode === 'production'
  // dev は常駐コンパイラを resources から取るので、本物を持たせて必ず捨てる
  const resources = new ResourceStore()
  onTestFinished(() => resources.disposeAll())

  const context = {
    paths: { root: project.root, src: project.path('src'), output: project.path('out') },
    isProduction,
    isDevelopment: !isProduction,
    sassGraph: new DependencyGraph(),
    resources
  }

  await sassTask(context)

  return {
    project,
    css: await readFile(project.path('out/style.css'), 'utf8'),
    files: await listFiles(project.path('out'))
  }
}

describe('圧縮', () => {
  it('production は圧縮する', async () => {
    const { css } = await run({ 'src/style.scss': '.a {\n  color: red;\n}\n' })

    expect(css).toBe('.a{color:red}')
  })

  it('dev は圧縮しない', async () => {
    const { css } = await run({ 'src/style.scss': '.a {\n  color: red;\n}\n' }, 'development')

    expect(css).toContain('color: red')
    expect(css).toContain('\n')
  })
})

describe('ソースマップ', () => {
  it('dev だけ出力し、CSS から指す', async () => {
    const { css, files } = await run({ 'src/style.scss': '.a { color: red; }\n' }, 'development')

    expect(files).toContain('style.css.map')
    expect(css).toContain('/*# sourceMappingURL=style.css.map */')
  })

  it('production では出力しない（納品物にソースを混ぜない）', async () => {
    const { css, files } = await run({ 'src/style.scss': '.a { color: red; }\n' })

    expect(files).not.toContain('style.css.map')
    expect(css).not.toContain('sourceMappingURL')
  })

  /**
   * Sass のマップを引き継がないと、ブラウザが指す行が「Sass が出した CSS」になり、
   * .scss まで辿れない。圧縮の有無より気づきにくい壊れ方をする
   */
  it('.scss まで辿れる（Sass のマップを引き継ぐ）', async () => {
    const { project } = await run({ 'src/style.scss': '$c: red;\n.a {\n  color: $c;\n}\n' }, 'development')
    const map = JSON.parse(await readFile(project.path('out/style.css.map'), 'utf8'))

    expect(map.sources.some(source => source.endsWith('.scss'))).toBe(true)
  })
})

describe('対象ブラウザ', () => {
  /**
   * .browserslistrc を読まないと、案件の要件と食い違ったCSSが黙って出る。
   * 観測点はプレフィックスの有無にする
   */
  it('.browserslistrc に応じてプレフィックスを付ける', async () => {
    const { css } = await run({
      '.browserslistrc': 'safari >= 14\n',
      'src/style.scss': '.a { user-select: none; }\n'
    })

    expect(css).toContain('-webkit-user-select')
  })

  it('新しいブラウザだけなら付けない', async () => {
    const { css } = await run({
      '.browserslistrc': 'last 1 chrome version\n',
      'src/style.scss': '.a { user-select: none; }\n'
    })

    expect(css).not.toContain('-webkit-user-select')
    // 前提: 対象のプロパティ自体は出力されている
    expect(css).toContain('user-select')
  })

  /**
   * pugkit が独自の設定項目を持たず browserslist に一本化していることの確認。
   * package.json 側に書いても同じ結果になる
   */
  it('package.json の browserslist も読む', async () => {
    const { css } = await run({
      'package.json': '{"name":"x","browserslist":["safari >= 14"]}',
      'src/style.scss': '.a { user-select: none; }\n'
    })

    expect(css).toContain('-webkit-user-select')
  })
})

describe('モダン構文の降格', () => {
  /**
   * ここが PostCSS の構成との一番の違い。autoprefixer は構文を降ろさないので、
   * 対象ブラウザが未対応でも素通りし、本番でだけスタイルが効かない状態になっていた
   */
  it('古い対象では入れ子を平らにする', async () => {
    const { css } = await run({
      '.browserslistrc': 'chrome >= 100\n',
      'src/style.scss': '.a { color: red; @media (width >= 40rem) { color: blue; } }\n'
    })

    // Sass が入れ子を解決した後、メディアクエリの範囲構文が降格される
    expect(css).toContain('min-width')
    expect(css).not.toContain('width >=')
  })

  it('新しい対象なら範囲構文のまま残す', async () => {
    const { css } = await run({
      '.browserslistrc': 'last 1 chrome version\n',
      'src/style.scss': '.a { color: red; @media (width >= 40rem) { color: blue; } }\n'
    })

    expect(css).toContain('width>=40rem')
  })
})

/**
 * `/` 始まりを src からの指定として解く。Pug の include と同じ書き方を揃えるため。
 *
 * 相対指定は Sass 自身の解決が先に働くので、importer を足しても経路が変わらないこと
 * を一緒に確かめる。片方だけ通っても意味がない
 */
describe('src を基点にした @use', () => {
  it('`/` 始まりを src から解決する', async () => {
    const { css } = await run({
      'src/sass/_test.scss': '.from-partial { color: red; }\n',
      'src/style.scss': "@use '/sass/test';\n.a { margin: 7px; }\n"
    })

    expect(css).toContain('.from-partial')
    expect(css).toContain('margin:7px')
  })

  it('パーシャルの `_` と拡張子を補完する', async () => {
    const { css } = await run({
      'src/sass/nested/_index.scss': '.from-index { color: red; }\n',
      'src/style.scss': "@use '/sass/nested';\n"
    })

    expect(css).toContain('.from-index')
  })

  it('相対指定はそのまま使える', async () => {
    const { css } = await run({
      'src/sass/_test.scss': '.from-partial { color: red; }\n',
      'src/assets/css/style.scss': "@use '../../sass/test';\n",
      'src/style.scss': '.entry { color: red; }\n'
    })

    // 前提: entry 側がビルドされている
    expect(css).toContain('.entry')
  })

  it('見つからなければ中止する', async () => {
    await expect(run({ 'src/style.scss': "@use '/sass/nope';\n" })).rejects.toThrow()
  })

  /**
   * 依存グラフに載らないと、パーシャルを直しても dev で反映されない。
   * ビルドが通ることと、差分ビルドが効くことは別
   */
  it('依存グラフに載る', async () => {
    const project = await createTempProject({
      'src/sass/_test.scss': '.from-partial { color: red; }\n',
      'src/style.scss': "@use '/sass/test';\n"
    })
    const resources = new ResourceStore()
    onTestFinished(() => resources.disposeAll())

    const sassGraph = new DependencyGraph()
    await sassTask({
      paths: { root: project.root, src: project.path('src'), output: project.path('out') },
      isProduction: false,
      isDevelopment: true,
      sassGraph,
      resources
    })

    expect(sassGraph.getAffectedParents(project.path('src/sass/_test.scss'))).toEqual([project.path('src/style.scss')])
  })
})
