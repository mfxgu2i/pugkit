import { describe, expect, it } from 'vitest'
import { build } from '../../index.mjs'
import { createTempProject, listFiles, minimalProjectFiles } from '../helpers/project.mjs'

/**
 * architecture.md:
 *   clean: true  … 出力ディレクトリを削除してから全ファイルを書き出す
 *   clean: false … 出力ディレクトリを削除せず全ファイルを上書き書き出す
 *
 * ここは rm を実行する唯一の経路なので、削除する範囲を仕様として固定する。
 */
describe('build.clean: true（既定）', () => {
  it('前回ビルドの残骸を消してから書き出す', async () => {
    const project = await createTempProject(minimalProjectFiles())
    await build(project.root)
    expect(await listFiles(project.path('dist'))).toContain('about.html')

    // ページを削除して再ビルドすると、出力からも消える
    await project.write({ 'src/about.pug': '' })
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
})

describe('build.clean: false（既存環境への組み込み）', () => {
  const integrationProject = () => ({
    ...minimalProjectFiles({
      'pugkit.config.mjs': "export default { outDir: 'htdocs', build: { clean: false } }\n"
    }),
    'htdocs/.htaccess': 'Deny from all\n',
    'htdocs/contact.php': '<?php echo 1;\n',
    'htdocs/uploads/photo.jpg': 'binary',
    'htdocs/legacy/index.html': '<html>legacy</html>'
  })

  it('既存ファイルを消さない', async () => {
    const project = await createTempProject(integrationProject())

    await build(project.root)

    const output = await listFiles(project.path('htdocs'))
    expect(output).toEqual(
      expect.arrayContaining(['.htaccess', 'contact.php', 'uploads/photo.jpg', 'legacy/index.html'])
    )
  })

  it('pugkit の生成物は追加・更新される', async () => {
    const project = await createTempProject(integrationProject())

    await build(project.root)
    expect(await project.read('htdocs/index.html')).toContain('<h1>Home</h1>')

    await project.write({ 'src/index.pug': 'extends /_partials/_layout.pug\nblock content\n  h1 Updated\n' })
    await build(project.root)

    expect(await project.read('htdocs/index.html')).toContain('<h1>Updated</h1>')
    // 既存資産は引き続き無傷
    expect(await listFiles(project.path('htdocs'))).toContain('contact.php')
  })

  it('本番成果物にソースマップを混ぜない', async () => {
    const project = await createTempProject(integrationProject())

    await build(project.root)

    expect((await listFiles(project.path('htdocs'))).filter(f => f.endsWith('.map'))).toEqual([])
  })
})
