import { describe, expect, it } from 'vitest'
import { build } from '../../index.mjs'
import { createTempProject, listFiles, minimalProjectFiles } from '../helpers/project.mjs'

/**
 * build は出力ディレクトリを削除してから全ファイルを書き出す。
 *
 * ここは rm を実行する唯一の経路なので、削除する範囲を仕様として固定する。
 * 「src から消したものが出力にも残らない」を保証する代わりに、
 * 出力先に手で置いたものは残らない。
 */
describe('出力ディレクトリの作り直し', () => {
  it('前回ビルドの残骸を消してから書き出す', async () => {
    const project = await createTempProject(minimalProjectFiles())
    await build(project.root)
    expect(await listFiles(project.path('dist'))).toContain('about.html')

    // ページを削除して再ビルドすると、出力からも消える
    const { rm } = await import('node:fs/promises')
    await rm(project.path('src/about.pug'))
    await build(project.root)

    expect(await listFiles(project.path('dist'))).not.toContain('about.html')
  })

  it('pugkit が作っていない既存ファイルも消す', async () => {
    const project = await createTempProject({
      ...minimalProjectFiles(),
      'dist/legacy.html': '<html>old</html>'
    })

    await build(project.root)

    expect(await listFiles(project.path('dist'))).not.toContain('legacy.html')
  })

  it('本番成果物にソースマップを混ぜない', async () => {
    const project = await createTempProject(minimalProjectFiles())

    await build(project.root)

    expect((await listFiles(project.path('dist'))).filter(f => f.endsWith('.map'))).toEqual([])
  })
})

describe('消してはいけない場所を outDir にしたとき', () => {
  /**
   * build は outDir を丸ごと削除してから書き出す。指定を誤ると
   * ソースや依存が消える。しかも削除は成功扱いなので、失ってから気づくことになる。
   *
   * 設定の検査だけでなく「実際に消えないこと」も固定する
   * （検査を通り抜ける経路が増えたときに気づけるように）
   */
  it.each([['src'], ['public'], ['node_modules']])('outDir が %s でも中身を消さない', async target => {
    const project = await createTempProject({
      ...minimalProjectFiles({ 'pugkit.config.mjs': `export default { outDir: '${target}' }\n` }),
      'public/keep.txt': 'keep\n',
      'node_modules/dep/index.js': 'module.exports = 1\n'
    })

    await expect(build(project.root)).rejects.toThrow()

    expect(await listFiles(project.path(target))).not.toEqual([])
  })
})

describe('廃止された build.clean', () => {
  // 設定が残っていても効かない。作り直しを止める手段はもう無い
  it('指定されていても出力ディレクトリを作り直す', async () => {
    const project = await createTempProject({
      ...minimalProjectFiles({
        'pugkit.config.mjs': "export default { build: { clean: false } }\n"
      }),
      'dist/legacy.html': '<html>old</html>'
    })

    await build(project.root)

    expect(await listFiles(project.path('dist'))).not.toContain('legacy.html')
  })
})

describe('subdir があるとき', () => {
  /**
   * 作り直す対象は outDir 全体。subdir の中だけを消すと、
   * subdir を変更したときに前の階層が残ったままデプロイされる
   * （src には無いページが本番に生き続ける）。
   */
  it('subdir の外にある前回の出力も消す', async () => {
    const project = await createTempProject(
      minimalProjectFiles({ 'pugkit.config.mjs': "export default { subdir: 'v2' }\n" })
    )
    // 前回 subdir: 'v1' でビルドしたときの残骸に相当する
    await project.write({ 'dist/v1/index.html': '<html>stale</html>' })

    await build(project.root)

    const output = await listFiles(project.path('dist'))
    expect(output).toContain('v2/index.html')
    expect(output.filter(f => f.startsWith('v1/'))).toEqual([])
  })
})
