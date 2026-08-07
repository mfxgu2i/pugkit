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

describe('廃止された build.clean', () => {
  /**
   * clean: false は「出力先の既存ファイルを消さない」設定だった。
   * 黙って無視すると、既存サイトに組み込んでいる利用者の outDir
   * （.htaccess・PHP・アップロード画像など）が次のビルドで丸ごと消える。
   * 取り返しがつかないので、警告ではなくエラーで止める。
   */
  it.each([[false], [true]])('build.clean: %s が残っていたらビルドを中止する', async clean => {
    const project = await createTempProject(
      minimalProjectFiles({
        'pugkit.config.mjs': `export default { outDir: 'htdocs', build: { clean: ${clean} } }\n`
      })
    )

    await expect(build(project.root)).rejects.toThrow(/build\.clean/)
  })

  it('中止したときは出力先に触れない', async () => {
    const project = await createTempProject({
      ...minimalProjectFiles({
        'pugkit.config.mjs': "export default { outDir: 'htdocs', build: { clean: false } }\n"
      }),
      'htdocs/.htaccess': 'Deny from all\n',
      'htdocs/contact.php': '<?php echo 1;\n',
      'htdocs/uploads/photo.jpg': 'binary'
    })

    await expect(build(project.root)).rejects.toThrow()

    expect(await listFiles(project.path('htdocs'))).toEqual(
      expect.arrayContaining(['.htaccess', 'contact.php', 'uploads/photo.jpg'])
    )
  })
})
