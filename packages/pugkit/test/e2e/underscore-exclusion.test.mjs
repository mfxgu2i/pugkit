import { describe, expect, it } from 'vitest'
import { build } from '../../index.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * README:
 *   「`_`（アンダースコア）で始まるファイル・ディレクトリはビルド対象外です」
 *
 * ページ・スタイル・スクリプト・画像・SVG のどのタスクでも同じ規則が効くことを固定する。
 * 一箇所でも漏れると「dev では見えるのに本番で消える（あるいはその逆）」の事故になる。
 */
describe('アンダースコア始まりの除外', () => {
  async function buildProject(files) {
    const project = await createTempProject({
      'package.json': '{"name":"fixture","type":"module"}',
      ...files
    })
    await build(project.root)
    return listFiles(project.path('dist'))
  }

  it('パーシャル（_ 始まりのファイル）を出力しない', async () => {
    const output = await buildProject({
      'src/index.pug': 'p home\n',
      'src/_partial.pug': 'p partial\n',
      'src/assets/css/_vars.scss': '$c: red;\n',
      'src/assets/css/style.scss': '.a { color: red; }\n'
    })

    expect(output).toContain('index.html')
    expect(output).not.toContain('_partial.html')
    expect(output.filter(f => f.includes('_vars'))).toEqual([])
  })

  it('_ 始まりディレクトリ配下を出力しない', async () => {
    const output = await buildProject({
      'src/index.pug': 'p home\n',
      'src/_drafts/secret.pug': 'p draft\n',
      'src/assets/css/style.scss': '.a { color: red; }\n',
      'src/_lib/helper.scss': '.helper { color: blue; }\n',
      'src/assets/js/main.js': 'console.log(1)\n',
      'src/_lib/helper.js': 'console.log("private")\n'
    })

    expect(output).toContain('index.html')
    // ページ
    expect(output.filter(f => f.startsWith('_drafts'))).toEqual([])
    // スタイル・スクリプト（glob の ignore が `_*.scss` だけだとここが漏れる）
    expect(output.filter(f => f.startsWith('_lib'))).toEqual([])
  })

  it('_ 始まりディレクトリの画像・SVG を出力しない', async () => {
    const output = await buildProject({
      'src/index.pug': 'p home\n',
      'src/assets/img/_wip/note.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n'
    })

    expect(output.filter(f => f.includes('_wip'))).toEqual([])
  })
})
