import { describe, it, expect } from 'vitest'
import { check } from '../../index.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * markuplint は pugkit の依存ではなく optional peer。
 * ここではリポジトリの devDependency として入っているものが解決される。
 */

const page = body =>
  ['<!DOCTYPE html>', '<html lang="ja">', '<head><meta charset="utf-8"><title>t</title></head>', body, '</html>'].join(
    '\n'
  )

async function checkProject(files) {
  const project = await createTempProject({
    'package.json': '{"name":"fixture","type":"module"}',
    'pugkit.config.mjs': 'export default {}',
    ...files
  })

  return check(project.root, ['markup'])
}

describe('マークアップの妥当性検査', () => {
  it('出力 HTML の違反を markuplint の報告のまま返す', async () => {
    const { findings } = await checkProject({
      'dist/index.html': page('<body><h1>t</h1><div id="x"></div><div id="x"></div></body>')
    })

    const duplication = findings.find(finding => finding.rule === 'id-duplication')

    expect(duplication).toBeTruthy()
    expect(duplication.file).toBe('index.html')
    expect(duplication.severity).toBe('error')
    expect(duplication.line).toBe(4)
  })

  it('違反が無ければ何も返さない', async () => {
    const { findings } = await checkProject({
      'dist/index.html': page('<body><h1>t</h1><p>問題のないページ</p></body>'),
      // 検査自体が動いていることの前提。これが無いと、1 ファイルも見ていなくても緑になる
      'dist/broken.html': page('<body><h1>t</h1><div id="x"></div><div id="x"></div></body>')
    })

    expect(findings.map(finding => finding.file)).toEqual(['broken.html'])
  })

  it('プロジェクトの markuplint 設定に従う', async () => {
    // 設定が唯一の真実であることの確認。既定なら報告される違反を、設定で黙らせる
    const html = page('<body><h1>t</h1><div id="x"></div><div id="x"></div></body>')

    const { findings: byDefault } = await checkProject({ 'dist/index.html': html })
    const { findings: byConfig } = await checkProject({
      '.markuplintrc': '{"rules":{"id-duplication":false}}',
      'dist/index.html': html
    })

    expect(byDefault.map(finding => finding.rule)).toContain('id-duplication')
    expect(byConfig.map(finding => finding.rule)).not.toContain('id-duplication')
  })

  it('設定が見つからないときは既定ルールで検査したことを知らせる', async () => {
    const { notices } = await checkProject({
      'dist/index.html': page('<body><h1>t</h1></body>')
    })

    expect(notices.join('\n')).toMatch(/既定ルール/)
  })

  it.each([
    ['.markuplintrc', '{"extends":["markuplint:recommended"]}'],
    ['markuplint.config.mjs', 'export default { extends: ["markuplint:recommended"] }'],
    ['package.json', '{"name":"fixture","type":"module","markuplint":{"extends":["markuplint:recommended"]}}']
  ])('%s があれば知らせない', async (name, content) => {
    const { notices } = await checkProject({
      [name]: content,
      'dist/index.html': page('<body><h1>t</h1></body>')
    })

    expect(notices).toEqual([])
  })

  it('項目を指定すると、その項目だけが走る', async () => {
    const project = await createTempProject({
      'package.json': '{"name":"fixture","type":"module"}',
      'pugkit.config.mjs': 'export default {}',
      // 参照の違反とマークアップの違反を両方持つページ
      'dist/index.html': page('<body><h1>t</h1><a href="/nowhere/">x</a><div id="d"></div><div id="d"></div></body>')
    })

    const markupOnly = await check(project.root, ['markup'])
    const both = await check(project.root)

    expect(markupOnly.findings.map(finding => finding.rule)).toContain('id-duplication')
    expect(markupOnly.findings.map(finding => finding.rule)).not.toContain('missing-reference')
    expect(both.findings.map(finding => finding.rule)).toContain('missing-reference')
  })

  it('検査対象の HTML が無ければ、その旨を伝える', async () => {
    const { findings, notices } = await checkProject({ 'dist/style.css': '.a { color: red; }' })

    expect(findings).toEqual([])
    expect(notices.join('\n')).toMatch(/検査していません/)
  })
})
