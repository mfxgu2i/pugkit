import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../config/main.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * pugkit.config.mjs の読み込みと、CLI から渡す値の優先順位。
 * process.cwd() に依存すると実行場所で結果が変わるため、必ず専用のルートを作る。
 */
describe('loadConfig', () => {
  it('設定ファイルが無ければ既定値を使う', async () => {
    const project = await createTempProject()
    const config = await loadConfig(project.root)

    expect(config.siteUrl).toBe('')
    expect(config.outDir).toBe('dist')
    expect(config.build.clean).toBe(true)
  })

  it('設定ファイルの値を読み込む', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { siteUrl: 'https://config.example.com/', outDir: 'htdocs' }\n"
    })
    const config = await loadConfig(project.root)

    expect(config.siteUrl).toBe('https://config.example.com/')
    expect(config.outDir).toBe('htdocs')
  })

  it('inlineConfig の siteUrl が設定ファイルより優先される', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { siteUrl: 'https://config.example.com/' }\n"
    })
    const config = await loadConfig(project.root, { siteUrl: 'https://cli.example.com/' })

    expect(config.siteUrl).toBe('https://cli.example.com/')
  })

  it('inlineConfig.siteUrl が未指定なら設定ファイルの値を保つ', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { siteUrl: 'https://config.example.com/' }\n"
    })
    const config = await loadConfig(project.root, { siteUrl: undefined })

    expect(config.siteUrl).toBe('https://config.example.com/')
  })

  it('設定ファイルが壊れていても既定値で起動する', async () => {
    const project = await createTempProject({ 'pugkit.config.mjs': 'this is not valid javascript {{{\n' })
    const config = await loadConfig(project.root)

    expect(config.outDir).toBe('dist')
  })
})

describe('既定値とのマージ', () => {
  // 一部だけ指定したときに残りの既定値が消えないこと。
  // 浅いマージにすると build.html や imageOptions がまるごと差し替わる
  it('build.html を部分指定しても他の整形オプションが残る', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': 'export default { build: { html: { indent_size: 4 } } }\n'
    })
    const config = await loadConfig(project.root)

    expect(config.build.html.indent_size).toBe(4)
    expect(config.build.html.content_unformatted).toBeDefined()
  })

  it('imageOptions.webp を部分指定しても他の形式の既定値が残る', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': 'export default { build: { imageOptions: { webp: { quality: 50 } } } }\n'
    })
    const config = await loadConfig(project.root)

    expect(config.build.imageOptions.webp.quality).toBe(50)
    expect(config.build.imageOptions.webp.effort).toBeDefined()
    expect(config.build.imageOptions.avif).toBeDefined()
  })

  it('build.clean: false を指定できる', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': 'export default { build: { clean: false } }\n'
    })
    const config = await loadConfig(project.root)

    expect(config.build.clean).toBe(false)
  })

  it('subdir は前後のスラッシュを落として保持する', async () => {
    const project = await createTempProject({ 'pugkit.config.mjs': "export default { subdir: '/sub/' }\n" })
    const config = await loadConfig(project.root)

    expect(config.subdir).toBe('sub')
  })
})

describe('outDir の安全確認', () => {
  // build の clean はここを rm -rf するため、危険な値は起動前に止める
  it.each([
    ['空文字（プロジェクトルート）', "''"],
    ['カレント', "'.'"],
    ['親ディレクトリ', "'..'"],
    ['さらに上', "'../..'"]
  ])('%s は拒否する', async (_label, value) => {
    const project = await createTempProject({
      'pugkit.config.mjs': `export default { outDir: ${value} }\n`
    })

    await expect(loadConfig(project.root)).rejects.toThrow(/outDir/)
  })

  it.each([['dist'], ['htdocs/v2'], ['../sibling-output']])('%s は許可する', async outDir => {
    const project = await createTempProject({
      'pugkit.config.mjs': `export default { outDir: '${outDir}' }\n`
    })

    await expect(loadConfig(project.root)).resolves.toBeDefined()
  })
})
