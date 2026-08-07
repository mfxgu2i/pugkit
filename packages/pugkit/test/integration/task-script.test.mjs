import { describe, expect, it } from 'vitest'
import { createBuilder } from '../../index.mjs'
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
