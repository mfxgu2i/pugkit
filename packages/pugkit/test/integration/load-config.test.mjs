import { describe, expect, it, vi, afterEach } from 'vitest'
import { isAbsolute } from 'node:path'
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

/**
 * 設定キーの誤り。値の検証と違って、キーの誤りは既定値のまま素通りする。
 * 例外にならないので、出力を1つずつ確かめない限り気づけない。
 */
describe('設定キーの検査', () => {
  /** logger は console.log に出すので、そちらを横取りする */
  const captureLogs = () => vi.spyOn(console, 'log').mockImplementation(() => {})

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('実在しないキーを警告する', async () => {
    const logs = captureLogs()
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { build: { imageOptimizatoin: 'compress' } }\n"
    })

    await loadConfig(project.root)

    expect(logs.mock.calls.map(args => args.join(' ')).join('\n')).toContain('build.imageOptimizatoin')
  })

  it('警告だけで中止はしない（既定値で動かせる）', async () => {
    captureLogs()
    const project = await createTempProject({ 'pugkit.config.mjs': "export default { outDirr: 'htdocs' } \n" })

    await expect(loadConfig(project.root)).resolves.toMatchObject({ outDir: 'dist' })
  })

  it('正しい設定では警告しない', async () => {
    const logs = captureLogs()
    const project = await createTempProject({
      'pugkit.config.mjs':
        "export default { build: { image: { format: 'compress', options: { webp: { quality: 50 } } } } }\n"
    })

    await loadConfig(project.root)

    expect(logs.mock.calls.map(args => args.join(' ')).join('\n')).not.toContain('不明なキー')
  })

  /**
   * v1 のキーは無視されるだけなので、compress を指定したのに webp で出る、
   * のような食い違いが黙って起きる。移行先が一意に決まるので中止して知らせる
   */
  it.each([
    ['build.imageOptimization', "export default { build: { imageOptimization: 'compress' } }\n"],
    ['build.imageSourceDensity', 'export default { build: { imageSourceDensity: 1 } }\n'],
    ['build.imageOptions', 'export default { build: { imageOptions: { webp: { quality: 50 } } } }\n'],
    ['build.imageOverrides', "export default { build: { imageOverrides: { 'a.jpg': {} } } }\n"],
    ['build.imageInfo', "export default { build: { imageInfo: { artDirectionSuffix: '_tb' } } }\n"]
  ])('v1 の %s が残っていたら中止する', async (key, source) => {
    const project = await createTempProject({ 'pugkit.config.mjs': source })

    await expect(loadConfig(project.root)).rejects.toThrow(key)
  })

  it('移行先を添える', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { build: { imageOptimization: 'compress' } }\n"
    })

    await expect(loadConfig(project.root)).rejects.toThrow('build.image.format')
  })
})

describe('既定値とのマージ', () => {
  // 一部だけ指定したときに残りの既定値が消えないこと。
  // 浅いマージにすると build.html や build.image.options がまるごと差し替わる
  it('build.html を部分指定しても他の整形オプションが残る', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': 'export default { build: { html: { indent_size: 4 } } }\n'
    })
    const config = await loadConfig(project.root)

    expect(config.build.html.indent_size).toBe(4)
    expect(config.build.html.content_unformatted).toBeDefined()
  })

  it('build.image.options.webp を部分指定しても他の形式の既定値が残る', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': 'export default { build: { image: { options: { webp: { quality: 50 } } } } }\n'
    })
    const config = await loadConfig(project.root)

    expect(config.build.image.options.webp.quality).toBe(50)
    expect(config.build.image.options.webp.effort).toBeDefined()
    expect(config.build.image.options.avif).toBeDefined()
  })

  it('build.image.format だけ指定しても sourceDensity の既定が残る', async () => {
    const project = await createTempProject({
      'pugkit.config.mjs': "export default { build: { image: { format: 'compress' } } }\n"
    })
    const config = await loadConfig(project.root)

    expect(config.build.image.format).toBe('compress')
    expect(config.build.image.sourceDensity).toBe(2)
    expect(config.build.image.artDirectionSuffix).toBe('_sp')
  })

  it('subdir は前後のスラッシュを落として保持する', async () => {
    const project = await createTempProject({ 'pugkit.config.mjs': "export default { subdir: '/sub/' }\n" })
    const config = await loadConfig(project.root)

    expect(config.subdir).toBe('sub')
  })
})

describe('outDir の安全確認', () => {
  // build はここを rm -rf するため、危険な値は起動前に止める
  it.each([
    ['空文字（プロジェクトルート）', "''"],
    ['カレント', "'.'"],
    ['親ディレクトリ', "'..'"],
    ['さらに上', "'../..'"],
    // ソースや依存を丸ごと消してしまう指定。cacheDir 側と同じ守りが要る
    ['src そのもの', "'src'"],
    ['public そのもの', "'public'"],
    ['node_modules そのもの', "'node_modules'"],
    ['src を内包するパス', "'.'"],
    ['src の配下', "'src/out'"],
    ['public の配下', "'public/out'"]
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

describe('root の解決', () => {
  /**
   * CLI は `pugkit build .` のように相対パスを受け取る。root が相対のままだと、
   * それを絶対パス前提で使う箇所（esbuild の absWorkingDir など）が壊れる。
   * paths を組み立てる前に一度だけ絶対化する。
   */
  it.each([['.'], ['./']])('相対パス %s を絶対パスにする', async input => {
    const project = await createTempProject()
    const previous = process.cwd()
    process.chdir(project.root)
    try {
      const config = await loadConfig(input)

      expect(isAbsolute(config.root)).toBe(true)
    } finally {
      process.chdir(previous)
    }
  })

  it('絶対パスはそのまま保つ', async () => {
    const project = await createTempProject()

    expect((await loadConfig(project.root)).root).toBe(project.root)
  })
})

/**
 * 画像設定の正規化。不正な値を黙って通すと、全画像が意図しない寸法や形式で
 * 出力されるという静かな壊れ方をする（build.clean を消したときと同じ形）。
 */
describe('画像設定の正規化', () => {
  const load = async source => {
    const project = await createTempProject({ 'pugkit.config.mjs': source })
    return loadConfig(project.root)
  }

  it('sourceDensity の既定は 2', async () => {
    const config = await load('export default {}\n')
    expect(config.build.image.sourceDensity).toBe(2)
  })

  it.each([1, 2])('sourceDensity: %i はそのまま通る', async value => {
    const config = await load(`export default { build: { image: { sourceDensity: ${value} } } }\n`)
    expect(config.build.image.sourceDensity).toBe(value)
  })

  it('不正な sourceDensity は 1 に倒す（半分の寸法で出力される事故を防ぐ）', async () => {
    const config = await load('export default { build: { image: { sourceDensity: 3 } } }\n')
    expect(config.build.image.sourceDensity).toBe(1)
  })

  it('format: false は webp として扱う', async () => {
    const config = await load('export default { build: { image: { format: false } } }\n')
    expect(config.build.image.format).toBe('webp')
  })

  it('未知の format は webp として扱う', async () => {
    const config = await load("export default { build: { image: { format: 'jpegxl' } } }\n")
    expect(config.build.image.format).toBe('webp')
  })

  it.each(['avif', 'webp', 'compress'])('format: %s はそのまま通る', async value => {
    const config = await load(`export default { build: { image: { format: '${value}' } } }\n`)
    expect(config.build.image.format).toBe(value)
  })
})
