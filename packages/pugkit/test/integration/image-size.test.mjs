import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { createImageInfoHelper as createHelper } from '../../transform/image-size.mjs'
import { CacheManager } from '../../core/cache.mjs'
import { ImageWidthRequests } from '../../core/image-widths.mjs'
import { createTempProject } from '../helpers/project.mjs'

// リポジトリ内の固定パスに書くと、テストを並列に走らせたとき互いのフィクスチャを消し合う
let testDataDir
let imagesDir
let mockPugFile
let paths
// 寸法キャッシュは BuildContext が持つ。テストの間は1つを共有して、
// 「セッション中は使い回す」という本番と同じ条件で確かめる
let cache

/**
 * テストは paths と config を最小構成で組み立てる。context の形はここで吸収する。
 * logger は null にして、意図的に壊した参照の警告で出力を埋めないようにする
 */
const createImageInfoHelper = (pugFile, config, options) =>
  createHelper(pugFile, { paths, config, cache }, { logger: null, ...options })

const clearImageSizeCache = () => cache.clearImageSizes()

const config = (format, density = 1, extra = {}) => ({
  build: { image: { format, sourceDensity: density, ...extra } }
})

const avifConfig = config('avif')
const webpConfig = config('webp')
const compressConfig = config('compress')

async function createJpeg(filePath, width = 100, height = 80) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 120, b: 120 } }
  })
    .jpeg()
    .toFile(filePath)
}

beforeEach(async () => {
  const project = await createTempProject({ 'images/.keep': '', 'index.pug': 'p x' })
  testDataDir = project.root
  imagesDir = project.path('images')
  // 「/」始まりの参照は paths.src からの絶対解決になる
  mockPugFile = project.path('index.pug')
  paths = { src: testDataDir, public: project.path('public') }
  cache = new CacheManager('development')

  await createJpeg(resolve(imagesDir, 'hero.jpg'), 800, 600)
  await createJpeg(resolve(imagesDir, 'responsive.jpg'), 800, 600)
  await createJpeg(resolve(imagesDir, 'responsive_sp.jpg'), 376, 300)
  await createJpeg(resolve(imagesDir, 'responsive_tb.jpg'), 768, 500)
  await writeFile(
    resolve(imagesDir, 'icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>'
  )
})

describe('createImageInfoHelper', () => {
  describe('基本情報の取得', () => {
    it('width / height / format を返す', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.width).toBe(800)
      expect(result.height).toBe(600)
      expect(result.format).toBe('jpg')
      expect(result.isSvg).toBe(false)
    })

    it('ファイルが存在しない場合は fallback を返す', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
      const result = imageInfo('/images/not-found.jpg')
      expect(result.src).toBe('/images/not-found.jpg')
      expect(result.width).toBeUndefined()
      expect(result.height).toBeUndefined()
      // 「見つからない」と「1 枚しか無い」をここで区別できるようにしておく
      expect(result.srcset).toBeUndefined()
      expect(result.variant).toBeNull()
    })
  })

  describe('src のパス解決', () => {
    it('build.image.format: avif のとき src が .avif パスになる', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, avifConfig)
      expect(imageInfo('/images/hero.jpg').src).toBe('/images/hero.avif')
    })

    it('build.image.format: webp のとき src が .webp パスになる', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
      expect(imageInfo('/images/hero.jpg').src).toBe('/images/hero.webp')
    })

    it('build.image.format: compress のとき src は元パスのまま', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, compressConfig)
      expect(imageInfo('/images/hero.jpg').src).toBe('/images/hero.jpg')
    })

    it('src に無ければ public も探す', async () => {
      await mkdir(resolve(paths.public, 'images'), { recursive: true })
      await writeFile(
        resolve(paths.public, 'images/only-public.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"></svg>'
      )

      const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
      const result = imageInfo('/images/only-public.svg')

      expect(result.width).toBe(12)
      expect(result.height).toBe(8)
    })
  })

  describe('public 配下の画像', () => {
    /**
     * public は copyTask がバイト列のまま出すだけ。変換も縮小もされないので、
     * 拡張子を読み替えると存在しないファイルを src に書いて 404 になる
     */
    beforeEach(async () => {
      await mkdir(resolve(paths.public, 'images'), { recursive: true })
      await createJpeg(resolve(paths.public, 'images/logo.jpg'), 240, 80)
    })

    it('webp モードでも拡張子を読み替えない', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      expect(imageInfo('/images/logo.jpg').src).toBe('/images/logo.jpg')
    })

    it('密度も適用しない（原寸をそのまま返す）', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const result = imageInfo('/images/logo.jpg')

      expect(result).toMatchObject({ width: 240, height: 80 })
      // 候補が 1 つなので srcset は書かない
      expect(result.srcset).toBeUndefined()
    })
  })

  describe('build.image.sourceDensity', () => {
    it('density 1 では原寸を返し srcset を出さない', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 1))
      const result = imageInfo('/images/hero.jpg')

      expect(result).toMatchObject({ src: '/images/hero.webp', width: 800, height: 600 })
      expect(result.srcset).toBeUndefined()
    })

    it('density 2 では src と width/height が表示サイズになる', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const result = imageInfo('/images/hero.jpg')

      expect(result).toMatchObject({ src: '/images/hero@half.webp', width: 400, height: 300 })
    })

    it('density 2 の srcset は 1x が縮小版、2x が無印（原寸）', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      expect(imageInfo('/images/hero.jpg').srcset).toBe('/images/hero@half.webp 1x, /images/hero.webp 2x')
    })

    it('compress モードでも密度は効く', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('compress', 2))
      expect(imageInfo('/images/hero.jpg').srcset).toBe('/images/hero@half.jpg 1x, /images/hero.jpg 2x')
    })

    it('縮小しても寸法が変わらない画像は 1 枚扱いになる', async () => {
      await createJpeg(resolve(imagesDir, 'tiny.jpg'), 1, 1)

      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const result = imageInfo('/images/tiny.jpg')

      expect(result).toMatchObject({ src: '/images/tiny.webp', width: 1, height: 1 })
      expect(result.srcset).toBeUndefined()
    })

    it('不正な密度は 1 として扱う（全画像が半分になる事故を防ぐ）', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 3))
      expect(imageInfo('/images/hero.jpg')).toMatchObject({ width: 800, height: 600 })
    })

    it('@2x 兄弟ファイルは検出しない（生成物の名前空間と衝突するため）', async () => {
      await createJpeg(resolve(imagesDir, 'sibling.jpg'), 800, 600)
      await createJpeg(resolve(imagesDir, 'sibling@2x.jpg'), 1600, 1200)

      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 1))
      const result = imageInfo('/images/sibling.jpg')

      expect(result.retina).toBeUndefined()
      expect(result.src).toBe('/images/sibling.webp')
      expect(result.srcset).toBeUndefined()
    })
  })

  describe('srcset の URL エンコード', () => {
    /**
     * srcset は「カンマ + 空白」区切り。区切り文字がそのまま入ると候補の切れ目を誤らせ、
     * srcset ごと無効になる。支給画像には空白入りのファイル名が混ざる
     */
    it('空白を含むファイル名でも候補が壊れない', async () => {
      await createJpeg(resolve(imagesDir, 'hero image.jpg'), 800, 600)

      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const { srcset } = imageInfo('/images/hero image.jpg')

      expect(srcset).toBe('/images/hero%20image@half.webp 1x, /images/hero%20image.webp 2x')
      // 前提: 候補が 2 つに分かれて読めること
      expect(srcset.split(', ')).toHaveLength(2)
    })

    it('カンマを含むファイル名でも候補が壊れない', async () => {
      await createJpeg(resolve(imagesDir, 'photo,1.jpg'), 800, 600)

      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const { srcset } = imageInfo('/images/photo,1.jpg')

      expect(srcset).toBe('/images/photo%2C1@half.webp 1x, /images/photo%2C1.webp 2x')
      expect(srcset.split(', ')).toHaveLength(2)
    })

    it('日本語はそのまま残す（区切りにならないので読みやすさを優先）', async () => {
      await createJpeg(resolve(imagesDir, 'メインビジュアル.jpg'), 800, 600)

      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const { srcset } = imageInfo('/images/メインビジュアル.jpg')

      expect(srcset).toBe('/images/メインビジュアル@half.webp 1x, /images/メインビジュアル.webp 2x')
    })
  })

  describe('アートディレクション variant 自動検出', () => {
    it('デフォルト（build.image.artDirectionSuffix: "_sp"）: avif モードで _sp が検出される', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, avifConfig)
      const result = imageInfo('/images/responsive.jpg')
      expect(result.variant).not.toBeNull()
      expect(result.variant.src).toBe('/images/responsive_sp.avif')
      expect(result.variant.width).toBe(376)
      expect(result.variant.height).toBe(300)
    })

    it('build.image.artDirectionSuffix: "_tb" のとき _tb が検出される', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 1, { artDirectionSuffix: '_tb' }))
      const result = imageInfo('/images/responsive.jpg')
      expect(result.variant).not.toBeNull()
      expect(result.variant.src).toBe('/images/responsive_tb.webp')
      expect(result.variant.width).toBe(768)
      expect(result.variant.height).toBe(500)
    })

    it('バリアント画像が存在しない場合は null', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
      expect(imageInfo('/images/hero.jpg').variant).toBeNull()
    })

    it('variant にも密度が適用される（source の width/height が実寸の 2 倍になるのを防ぐ）', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const { variant } = imageInfo('/images/responsive.jpg')

      expect(variant).toMatchObject({ src: '/images/responsive_sp@half.webp', width: 188, height: 150 })
      expect(variant.srcset).toBe('/images/responsive_sp@half.webp 1x, /images/responsive_sp.webp 2x')
    })

    it('density 1 でも variant.srcset は必ず出す（source が無視されるのを防ぐ）', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 1))
      expect(imageInfo('/images/responsive.jpg').variant.srcset).toBe('/images/responsive_sp.webp 1x')
    })
  })

  describe('SVG', () => {
    it('isSvg: true / variant: null、src は変換されない', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, config('webp', 2))
      const result = imageInfo('/images/icon.svg')
      expect(result.isSvg).toBe(true)
      expect(result.src).toBe('/images/icon.svg')
      expect(result.variant).toBeNull()
      // 密度の対象外なので候補は 1 つ。srcset は書かない
      expect(result.srcset).toBeUndefined()
    })
  })
})

/**
 * 幅は呼び出し側が渡す。生成側はこの記録だけを見て作るので、
 * ここで剪定を誤ると「srcset に載っているのにファイルが無い」か「誰も参照しない孤児」が出る。
 */
describe('幅の収集', () => {
  const createWithStore = (imageConfig = webpConfig) => {
    const imageWidths = new ImageWidthRequests()
    const warnings = []
    const warnOnce = (scope, reason, message) => warnings.push({ reason, message })
    const imageInfo = createHelper(
      mockPugFile,
      { paths, config: imageConfig, cache, imageWidths, warnOnce },
      {
        logger: null
      }
    )

    return { imageInfo, imageWidths, warnings }
  }

  it('渡さなければ何も記録しない', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/hero.jpg')

    expect(imageWidths.get(resolve(imagesDir, 'hero.jpg'))).toEqual([])
  })

  it('渡した幅を記録する', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/hero.jpg', { widths: [400, 600] })

    expect(imageWidths.get(resolve(imagesDir, 'hero.jpg'))).toEqual([400, 600])
  })

  /** 原寸は無印が兼ねる。作ると同じ中身が 2 枚出る */
  it('原寸以上の幅は記録しない', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/hero.jpg', { widths: [400, 800, 1200] })

    expect(imageWidths.get(resolve(imagesDir, 'hero.jpg'))).toEqual([400])
  })

  it('_sp にも同じ幅を掛け、原寸の違いで別々に剪定する', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/responsive.jpg', { widths: [200, 500] })

    expect(imageWidths.get(resolve(imagesDir, 'responsive.jpg'))).toEqual([200, 500])
    // _sp は 376px なので 500 は落ちる
    expect(imageWidths.get(resolve(imagesDir, 'responsive_sp.jpg'))).toEqual([200])
  })

  it('SVG は幅の対象外', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/icon.svg', { widths: [16] })

    expect(imageWidths.get(resolve(imagesDir, 'icon.svg'))).toEqual([])
  })

  it('public の画像には効かないことを知らせる', async () => {
    await mkdir(resolve(testDataDir, 'public/images'), { recursive: true })
    await createJpeg(resolve(testDataDir, 'public/images/ogp.jpg'), 1200, 630)

    const { imageInfo, imageWidths, warnings } = createWithStore()
    imageInfo('/images/ogp.jpg', { widths: [400] })

    expect(imageWidths.get(resolve(testDataDir, 'public/images/ogp.jpg'))).toEqual([])
    expect(warnings.map(w => w.reason)).toContain('widths-on-public-image')
  })

  it('使えない値は落として知らせる', () => {
    const { imageInfo, imageWidths, warnings } = createWithStore()
    imageInfo('/images/hero.jpg', { widths: [400, -100, '600', 0] })

    expect(imageWidths.get(resolve(imagesDir, 'hero.jpg'))).toEqual([400])
    expect(warnings.map(w => w.reason)).toContain('invalid-image-widths')
  })

  it('幅記述子の srcset を昇順で出し、無印が最大の候補を兼ねる', () => {
    const { imageInfo } = createWithStore()
    const result = imageInfo('/images/hero.jpg', { widths: [200, 400] })

    expect(result.srcset).toBe('/images/hero@200w.webp 200w, /images/hero@400w.webp 400w, /images/hero.webp 800w')
  })

  it('src と width/height は原寸（表示幅は sizes が決める）', () => {
    const { imageInfo } = createWithStore(config('webp', 2))
    const result = imageInfo('/images/hero.jpg', { widths: [400] })

    expect(result).toMatchObject({ src: '/images/hero.webp', width: 800, height: 600 })
  })

  it('sizes をそのまま返す', () => {
    const { imageInfo } = createWithStore()
    const sizes = '(max-width: 768px) 100vw, 800px'

    expect(imageInfo('/images/hero.jpg', { widths: [400], sizes }).sizes).toBe(sizes)
  })

  /** 密度記述子に sizes を付けても無視される。納品HTMLに意味の無い属性を残さない */
  it('密度モードでは sizes を返さない', () => {
    const { imageInfo } = createWithStore()

    expect(imageInfo('/images/hero.jpg', { sizes: '100vw' }).sizes).toBeUndefined()
  })

  /** 記述子の混在は仕様の適合要件。densityOutputs を流用するので事故が起きやすい */
  it('w と x を 1 つの srcset に混ぜない', () => {
    const { imageInfo } = createWithStore(config('webp', 2))
    const { srcset } = imageInfo('/images/hero.jpg', { widths: [400] })

    expect(srcset).not.toMatch(/\dx/)
    expect(srcset).not.toContain('@half')
  })

  it('_sp は候補がすべて剪定されても幅モードのまま', () => {
    const { imageInfo } = createWithStore()
    const { variant } = imageInfo('/images/responsive.jpg', { widths: [600], sizes: '100vw' })

    // _sp は 376px なので 600 は落ち、無印だけが残る
    expect(variant.srcset).toBe('/images/responsive_sp.webp 376w')
    expect(variant.sizes).toBe('100vw')
  })

  it('SVG は幅を渡しても密度モードのまま', () => {
    const { imageInfo } = createWithStore()
    const result = imageInfo('/images/icon.svg', { widths: [16], sizes: '100vw' })

    expect(result.src).toBe('/images/icon.svg')
    expect(result.srcset).toBeUndefined()
    expect(result.sizes).toBeUndefined()
  })

  /**
   * srcset が無ければ sizes も意味を持たない。
   * 片方だけ残すと、選びようのない候補に対する指定が納品 HTML に残る
   */
  it('候補が 1 つなら img の srcset も sizes も出さない', () => {
    const { imageInfo } = createWithStore()
    // 800px の画像に 800 以上だけを渡すと、剪定後は無印 1 枚になる
    const result = imageInfo('/images/hero.jpg', { widths: [1200], sizes: '100vw' })

    expect(result.srcset).toBeUndefined()
    expect(result.sizes).toBeUndefined()
  })

  /** source は srcset が必須。落とすと source ごと無効になり SP 画像が出ない */
  it('候補が 1 つでも variant の srcset は出す', () => {
    const { imageInfo } = createWithStore()
    const { variant } = imageInfo('/images/responsive.jpg', { widths: [600], sizes: '100vw' })

    expect(variant.srcset).toBe('/images/responsive_sp.webp 376w')
  })

  it('同じ画像を違う幅で参照したら和集合になる', () => {
    const { imageInfo, imageWidths } = createWithStore()
    imageInfo('/images/hero.jpg', { widths: [400] })
    imageInfo('/images/hero.jpg', { widths: [600] })

    expect(imageWidths.get(resolve(imagesDir, 'hero.jpg'))).toEqual([400, 600])
  })
})

describe('onAccess コールバック', () => {
  it('variant が存在する場合 onAccess にメイン・variant 両方が登録される', () => {
    const accessed = []
    const imageInfo = createImageInfoHelper(mockPugFile, webpConfig, { onAccess: p => accessed.push(p) })
    imageInfo('/images/responsive.jpg')
    expect(accessed).toContain(resolve(imagesDir, 'responsive.jpg'))
    expect(accessed).toContain(resolve(imagesDir, 'responsive_sp.jpg'))
  })

  it('画像が見つからない場合 onAccess は呼ばれない', () => {
    const accessed = []
    const imageInfo = createImageInfoHelper(mockPugFile, webpConfig, { onAccess: p => accessed.push(p) })
    imageInfo('/images/not-found.jpg')
    expect(accessed).toHaveLength(0)
  })

  it('onAccess なしで呼んでもエラーにならない', () => {
    const imageInfo = createImageInfoHelper(mockPugFile, webpConfig)
    expect(() => imageInfo('/images/hero.jpg')).not.toThrow()
  })
})

describe('寸法のキャッシュ', () => {
  /**
   * 同じ画像は複数ページから参照されるので、読み取り結果をセッション中は使い回す。
   * watcher は画像が変わったときに clearImageSizeCache() を呼ぶ責務を持つ。
   * ここが効いていないと dev の HTML に古い width/height が焼き込まれたままになる。
   */
  const infoOf = src => createImageInfoHelper(mockPugFile, compressConfig)(src)

  beforeEach(() => clearImageSizeCache())

  it('差し替えても、キャッシュを消すまでは前の寸法を返す', async () => {
    expect(infoOf('/images/hero.jpg').width).toBe(800)

    await createJpeg(resolve(imagesDir, 'hero.jpg'), 320, 240)

    expect(infoOf('/images/hero.jpg').width).toBe(800)
  })

  it('キャッシュを消すと新しい寸法を返す', async () => {
    infoOf('/images/hero.jpg')
    await createJpeg(resolve(imagesDir, 'hero.jpg'), 320, 240)

    clearImageSizeCache()

    expect(infoOf('/images/hero.jpg')).toMatchObject({ width: 320, height: 240 })
  })

  it('variant の寸法もキャッシュを消せば追随する', async () => {
    infoOf('/images/responsive.jpg')
    await createJpeg(resolve(imagesDir, 'responsive_sp.jpg'), 100, 80)

    clearImageSizeCache()

    expect(infoOf('/images/responsive.jpg').variant).toMatchObject({ width: 100, height: 80 })
  })
})
