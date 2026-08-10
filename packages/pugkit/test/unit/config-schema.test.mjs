import { describe, expect, it } from 'vitest'
import { inspectConfigKeys, RENAMED_KEYS } from '../../config/schema.mjs'
import { defaultConfig } from '../../config/defaults.mjs'

/**
 * 設定キーの検査。値の検証と違い、キーの誤りは既定値のまま素通りして
 * 「指定したのに効かない」という例外にならない壊れ方をする。
 */
describe('実在しないキー', () => {
  it('トップレベルの綴り違いを拾う', () => {
    expect(inspectConfigKeys({ outDirr: 'dist' }).unknown).toEqual(['outDirr'])
  })

  it('入れ子の綴り違いをパスで返す', () => {
    expect(inspectConfigKeys({ server: { prot: 3000 } }).unknown).toEqual(['server.prot'])
  })

  it('正しいキーは何も返さない', () => {
    const found = inspectConfigKeys({
      siteUrl: 'https://example.com/',
      subdir: 'sub',
      outDir: 'dist',
      cacheDir: null,
      server: { port: 3000, host: '0.0.0.0', startPath: '/', domDiff: false },
      build: { image: { format: 'avif', sourceDensity: 1, artDirectionSuffix: '_tb' } }
    })

    expect(found).toEqual({ unknown: [], renamed: [] })
  })

  it('設定ファイルが空でも壊れない', () => {
    expect(inspectConfigKeys({})).toEqual({ unknown: [], renamed: [] })
    expect(inspectConfigKeys(undefined)).toEqual({ unknown: [], renamed: [] })
  })

  it('知らないキーの中までは降りない（誤りの起点だけを報告する）', () => {
    expect(inspectConfigKeys({ bild: { image: { format: 'webp' } } }).unknown).toEqual(['bild'])
  })
})

/**
 * 中身を外部ライブラリや利用者の命名にそのまま渡す場所は、
 * pugkit が有効なキーを知らないので検査してはいけない。
 * ここを検査すると、正しい設定に警告が出る。
 */
describe('検査しない場所', () => {
  it('build.html は js-beautify のオプションをそのまま通す', () => {
    const found = inspectConfigKeys({
      build: { html: { indent_size: 4, unformatted: ['b'], indent_inner_html: true } }
    })

    expect(found.unknown).toEqual([])
  })

  it('build.image.overrides のキーは利用者のファイル名', () => {
    const found = inspectConfigKeys({
      build: { image: { overrides: { 'assets/img/bg-hero.jpg': { quality: 100 } } } }
    })

    expect(found.unknown).toEqual([])
  })

  it('build.image.options の中身は sharp のオプション', () => {
    const found = inspectConfigKeys({ build: { image: { options: { webp: { nearLossless: true } } } } })

    expect(found.unknown).toEqual([])
  })

  it('形式名そのものは検査する（webpp と書けば全画像の設定が無視される）', () => {
    const found = inspectConfigKeys({ build: { image: { options: { webpp: { quality: 50 } } } } })

    expect(found.unknown).toEqual(['build.image.options.webpp'])
  })
})

describe('v1 から名前が変わったキー', () => {
  it.each(Object.keys(RENAMED_KEYS))('%s を旧名として報告する', key => {
    const [parent, child] = key.split('.')
    const found = inspectConfigKeys({ [parent]: { [child]: 'anything' } })

    expect(found.renamed).toEqual([key])
  })

  it('旧名は「実在しないキー」には数えない（移行先を示せるため扱いを分ける）', () => {
    const found = inspectConfigKeys({ build: { imageOptimization: 'compress' } })

    expect(found.unknown).toEqual([])
  })

  it('旧名の中までは降りない', () => {
    const found = inspectConfigKeys({ build: { imageOptions: { webp: { quality: 50 } } } })

    expect(found).toEqual({ unknown: [], renamed: ['build.imageOptions'] })
  })

  it('複数あればすべて集める', () => {
    const found = inspectConfigKeys({ build: { imageOptimization: 'webp', imageSourceDensity: 2 } })

    expect(found.renamed).toEqual(['build.imageOptimization', 'build.imageSourceDensity'])
  })

  /**
   * 移行先の綴りを間違えると、案内どおりに直しても今度は「不明なキー」になる。
   * 対応表は手書きなので、実在する場所を指しているかを機械で確かめる
   */
  it('移行先はすべて実在するキーを指す', () => {
    for (const target of Object.values(RENAMED_KEYS)) {
      const resolved = target.split('.').reduce((node, key) => node?.[key], defaultConfig)

      expect(resolved, `${target} が defaultConfig に無い`).toBeDefined()
    }
  })
})
