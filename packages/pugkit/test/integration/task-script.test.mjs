import { describe, expect, it } from 'vitest'
import { createBuilder } from '../../index.mjs'
import { readFile, stat } from 'node:fs/promises'
import { createTempProject } from '../helpers/project.mjs'

/**
 * esbuild が解決した import を依存グラフに記録する。
 *
 * このグラフが dev の差分ビルドの土台になるので、空でも壊れていても
 * エラーにはならず「編集しても反映されない」という形でしか現れない。
 * metafile のパスは esbuild の作業ディレクトリ基準なので、
 * プロセスの作業ディレクトリとプロジェクトルートが違っても正しく解決できること。
 */
async function buildScripts(files) {
  const project = await createTempProject({
    'package.json': '{"name":"script-graph","type":"module"}',
    'pugkit.config.mjs': 'export default {}\n',
    'src/index.pug': 'doctype html\nhtml\n  body\n    p x\n',
    ...files
  })
  const builder = await createBuilder(project.root, 'development')
  await builder.runTask('script')

  return { project, graph: builder.context.scriptGraph }
}

describe('依存グラフ', () => {
  it('import 元をエントリの依存として記録する', async () => {
    const { project, graph } = await buildScripts({
      'src/assets/js/_lib/util.js': 'export const tag = 1\n',
      'src/assets/js/main.js': "import { tag } from './_lib/util.js'\nconsole.log(tag)\n"
    })

    expect(graph.getAffectedParents(project.path('src/assets/js/_lib/util.js'))).toEqual([
      project.path('src/assets/js/main.js')
    ])
  })

  it('エントリ同士の import も記録する', async () => {
    // 「それ自体エントリで、かつ他からも import される」共有ファイルはよくある形
    const { project, graph } = await buildScripts({
      'src/assets/js/shared.js': 'export const v = 1\n',
      'src/assets/js/main.js': "import { v } from './shared.js'\nconsole.log(v)\n"
    })

    expect(graph.getAffectedParents(project.path('src/assets/js/shared.js'))).toEqual([
      project.path('src/assets/js/main.js')
    ])
  })

  it('入れ子の import もたどれる', async () => {
    const { project, graph } = await buildScripts({
      'src/assets/js/_lib/deep.js': 'export const d = 1\n',
      'src/assets/js/_lib/util.js': "export { d } from './deep.js'\n",
      'src/assets/js/main.js': "import { d } from './_lib/util.js'\nconsole.log(d)\n"
    })

    // esbuild はバンドルするので、間接依存もエントリの入力として現れる
    expect(graph.getAffectedParents(project.path('src/assets/js/_lib/deep.js'))).toEqual([
      project.path('src/assets/js/main.js')
    ])
  })

  it('import していないエントリは依存に含めない', async () => {
    const { project, graph } = await buildScripts({
      'src/assets/js/_lib/util.js': 'export const tag = 1\n',
      'src/assets/js/main.js': "import { tag } from './_lib/util.js'\nconsole.log(tag)\n",
      'src/assets/js/other.js': "console.log('other')\n"
    })

    expect(graph.getAffectedParents(project.path('src/assets/js/_lib/util.js'))).not.toContain(
      project.path('src/assets/js/other.js')
    )
  })
})

describe('dev の差分ビルド', () => {
  /**
   * 変更を反映する範囲は依存グラフで決める。
   * ファイル名で判断すると「_ が付かない共有ファイル」を取りこぼす。
   */
  const readOut = async (builder, name) =>
    readFile(`${builder.context.paths.outputRoot}/assets/js/${name}`, 'utf8')

  it('共有ファイルの変更を、参照しているエントリに反映する', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"script-partial","type":"module"}',
      'pugkit.config.mjs': 'export default {}\n',
      'src/index.pug': 'doctype html\nhtml\n  body\n    p x\n',
      // 「_」が付かないのでファイル名からは共有ファイルだと分からない
      'src/assets/js/shared.js': "export const v = 'V1'\n",
      'src/assets/js/main.js': "import { v } from './shared.js'\nconsole.log(v)\n"
    })
    const builder = await createBuilder(project.root, 'development')
    await builder.runTask('script')

    await project.write({ 'src/assets/js/shared.js': "export const v = 'V2'\n" })
    await builder.runTask('script', { files: [project.path('src/assets/js/shared.js')] })

    expect(await readOut(builder, 'main.js')).toContain('V2')
  })

  it('依存していないエントリは作り直さない', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"script-scope","type":"module"}',
      'pugkit.config.mjs': 'export default {}\n',
      'src/index.pug': 'doctype html\nhtml\n  body\n    p x\n',
      'src/assets/js/_lib/util.js': 'export const tag = 1\n',
      'src/assets/js/main.js': "import { tag } from './_lib/util.js'\nconsole.log(tag)\n",
      'src/assets/js/other.js': "console.log('other')\n"
    })
    const builder = await createBuilder(project.root, 'development')
    await builder.runTask('script')
    const before = (await stat(`${builder.context.paths.outputRoot}/assets/js/other.js`)).mtimeMs

    await new Promise(resolve => setTimeout(resolve, 10)) // mtime の解像度を確保する
    await project.write({ 'src/assets/js/_lib/util.js': 'export const tag = 2\n' })
    await builder.runTask('script', { files: [project.path('src/assets/js/_lib/util.js')] })

    expect(await readOut(builder, 'main.js')).toContain('2')
    expect((await stat(`${builder.context.paths.outputRoot}/assets/js/other.js`)).mtimeMs).toBe(before)
  })
})
