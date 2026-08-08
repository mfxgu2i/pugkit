import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { stat, readFile, writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { imageOutputPaths, imageTask } from '../../tasks/image.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * 画像タスク。imageOverrides でファイル単位に変換設定を上書きできることと、
 * imageOptimization / imageSourceDensity の組み合わせで出力が変わることを固定する。
 */
let project
let srcDir
let distDir
let publicDir

async function createJpeg(filePath, width = 200, height = 150) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } }
  })
    .jpeg({ quality: 100 })
    .toFile(filePath)
}

function makeContext({ overrides = {}, optimization = 'webp', imageOptions = {}, density = 1 } = {}) {
  return {
    paths: { src: srcDir, output: distDir, public: publicDir },
    config: {
      build: {
        imageOptimization: optimization,
        imageSourceDensity: density,
        imageOptions: {
          webp: { quality: 30, effort: 0, lossless: false },
          jpeg: { quality: 30 },
          png: { quality: 30, compressionLevel: 9 },
          avif: { quality: 30, effort: 0 },
          ...imageOptions
        },
        imageOverrides: overrides
      }
    },
    isProduction: true
  }
}

beforeEach(async () => {
  project = await createTempProject({ 'src/.keep': '', 'dist/.keep': '', 'public/.keep': '' })
  srcDir = project.path('src')
  distDir = project.path('dist')
  publicDir = project.path('public')
  await createJpeg(resolve(srcDir, 'normal.jpg'))
  await createJpeg(resolve(srcDir, 'mv.jpg'))
})

describe('imageOverrides', () => {
  it('特定の画像だけ quality を上げると出力が大きくなる', async () => {
    await imageTask(makeContext({ overrides: { 'mv.jpg': { quality: 100 } } }))

    const normalSize = (await stat(resolve(distDir, 'normal.webp'))).size
    const mvSize = (await stat(resolve(distDir, 'mv.webp'))).size

    // 同じ寸法の画像なので quality の差がそのままサイズに出る
    expect(mvSize).toBeGreaterThan(normalSize)
  })

  it('特定の画像だけ lossless にできる', async () => {
    await imageTask(makeContext({ overrides: { 'mv.jpg': { lossless: true } } }))

    // WebP のチャンク ID で lossy(VP8 ) / lossless(VP8L) を判別する
    const chunkId = async name => (await readFile(resolve(distDir, name))).subarray(12, 16).toString('ascii')

    expect(await chunkId('normal.webp')).toBe('VP8 ')
    expect(await chunkId('mv.webp')).toBe('VP8L')
  })

  it('avif モードでも overrides が効く', async () => {
    await imageTask(
      makeContext({
        overrides: { 'mv.jpg': { quality: 100 } },
        optimization: 'avif',
        imageOptions: { avif: { quality: 10, effort: 0 } }
      })
    )

    const normalSize = (await stat(resolve(distDir, 'normal.avif'))).size
    const mvSize = (await stat(resolve(distDir, 'mv.avif'))).size

    expect(mvSize).toBeGreaterThan(normalSize)
  })

  it('overrides は原寸と縮小版の両方に効く', async () => {
    await imageTask(makeContext({ density: 2, overrides: { 'mv.jpg': { lossless: true } } }))

    const chunkId = async name => (await readFile(resolve(distDir, name))).subarray(12, 16).toString('ascii')

    expect(await chunkId('mv.webp')).toBe('VP8L')
    expect(await chunkId('mv@half.webp')).toBe('VP8L')
    expect(await chunkId('normal@half.webp')).toBe('VP8 ')
  })
})

describe('imageOptimization', () => {
  it('webp は .webp に変換する', async () => {
    await imageTask(makeContext({ optimization: 'webp' }))
    expect(await listFiles(distDir)).toEqual(expect.arrayContaining(['normal.webp', 'mv.webp']))
  })

  it('compress は元の形式のまま出力する', async () => {
    await imageTask(makeContext({ optimization: 'compress' }))

    const output = await listFiles(distDir)
    expect(output).toEqual(expect.arrayContaining(['normal.jpg', 'mv.jpg']))
    expect(output.filter(f => f.endsWith('.webp'))).toEqual([])
  })
})

describe('imageSourceDensity', () => {
  it('density 1 では原寸 1 枚だけを出す', async () => {
    await imageTask(makeContext({ density: 1 }))

    const output = await listFiles(distDir)
    // 前提: 対象の画像が実際に処理されている
    expect(output).toContain('normal.webp')
    expect(output.filter(f => f.includes('@'))).toEqual([])
  })

  it('density 2 では無印が原寸、@half が半分の寸法になる', async () => {
    await imageTask(makeContext({ density: 2 }))

    const original = await sharp(resolve(distDir, 'normal.webp')).metadata()
    const scaled = await sharp(resolve(distDir, 'normal@half.webp')).metadata()

    expect(original).toMatchObject({ width: 200, height: 150 })
    expect(scaled).toMatchObject({ width: 100, height: 75 })
  })

  it('縮小しても寸法が変わらない画像は 2 枚目を作らない', async () => {
    await createJpeg(resolve(srcDir, 'tiny.jpg'), 1, 1)
    await imageTask(makeContext({ density: 2 }))

    const output = await listFiles(distDir)
    // 前提: 対象の画像が処理されている（処理されていなければ「無いこと」は自明に通る）
    expect(output).toContain('tiny.webp')
    expect(output).not.toContain('tiny@half.webp')
  })

  it('GIF は密度の対象外（webp に変換されるが 1 枚だけ）', async () => {
    await sharp({ create: { width: 40, height: 30, channels: 3, background: '#123456' } })
      .gif()
      .toFile(resolve(srcDir, 'anim.gif'))

    await imageTask(makeContext({ density: 2 }))

    const output = await listFiles(distDir)
    expect(output).toContain('anim.webp')
    expect(output).not.toContain('anim@half.webp')
  })

  it('compress モードの GIF は素通しコピーする', async () => {
    const source = resolve(srcDir, 'anim.gif')
    await sharp({ create: { width: 40, height: 30, channels: 3, background: '#123456' } })
      .gif()
      .toFile(source)

    await imageTask(makeContext({ density: 2, optimization: 'compress' }))

    expect(await readFile(resolve(distDir, 'anim.gif'))).toEqual(await readFile(source))
  })
})

describe('出力先の衝突', () => {
  /**
   * 同じ出力先に二人以上が書くと、どちらが残るかが Promise.all の完了順で決まる。
   * 黙って片方を捨てると「置いたはずの画像が使われていない」ことに気づけないので中止する
   */
  it('別のソースが同じ出力先に写像したら中止する', async () => {
    // density 2 では normal.jpg が normal@half.webp を生むので、手置きの @half と衝突する
    await createJpeg(resolve(srcDir, 'normal@half.jpg'))

    await expect(imageTask(makeContext({ density: 2 }))).rejects.toThrow(/normal@half\.webp/)
  })

  it('public と同じ出力先になったら中止する', async () => {
    await mkdir(publicDir, { recursive: true })
    await writeFile(resolve(publicDir, 'normal.webp'), 'public-wins')

    await expect(imageTask(makeContext({ density: 2 }))).rejects.toThrow(/normal\.webp/)
  })

  it('中止したときは何も出力しない（半端な成果物を残さない）', async () => {
    await mkdir(publicDir, { recursive: true })
    await writeFile(resolve(publicDir, 'normal.webp'), 'public-wins')

    await imageTask(makeContext({ density: 2 })).catch(() => {})

    // 前提: 衝突していない画像も含めて 1 枚も出ていない
    expect(await listFiles(distDir)).toEqual(['.keep'])
  })

  it('衝突の相手が分かるメッセージを出す', async () => {
    await createJpeg(resolve(srcDir, 'normal@half.jpg'))

    const error = await imageTask(makeContext({ density: 2 })).catch(e => e)

    expect(error.message).toContain('src/normal.jpg')
    expect(error.message).toContain('src/normal@half.jpg')
  })

  it('変更されたファイルだけの処理でも衝突を見る（dev 中の追加を取りこぼさない）', async () => {
    await createJpeg(resolve(srcDir, 'normal@half.jpg'))

    await expect(
      imageTask(makeContext({ density: 2 }), { changed: resolve(srcDir, 'normal@half.jpg') })
    ).rejects.toThrow(/normal@half\.webp/)
  })

  it('衝突が無ければ public と src は共存できる', async () => {
    await mkdir(publicDir, { recursive: true })
    await writeFile(resolve(publicDir, 'logo.svg'), '<svg/>')

    await imageTask(makeContext({ density: 2 }))

    expect(await listFiles(distDir)).toEqual(expect.arrayContaining(['normal.webp', 'normal@half.webp']))
  })
})

describe('出力先の規則', () => {
  /**
   * 生成側と、watcher の削除側で規則がずれると、
   * 消したはずの画像が配信され続ける（スプライトで実際に起きた形）。
   * 規則は imageOutputPaths 一つに集約し、両方から使う。
   */
  const paths = { src: '/proj/src', output: '/proj/dist', public: '/proj/public' }
  const config = (optimization, density) => ({
    build: { imageOptimization: optimization, imageSourceDensity: density }
  })

  it.each([
    ['webp', 1, 'img/a.jpg', ['/proj/dist/img/a.webp']],
    ['webp', 2, 'img/a.jpg', ['/proj/dist/img/a.webp', '/proj/dist/img/a@half.webp']],
    ['webp', 2, 'img/a.PNG', ['/proj/dist/img/a.webp', '/proj/dist/img/a@half.webp']],
    ['avif', 2, 'img/a.jpg', ['/proj/dist/img/a.avif', '/proj/dist/img/a@half.avif']],
    ['compress', 2, 'img/a.jpg', ['/proj/dist/img/a.jpg', '/proj/dist/img/a@half.jpg']],
    // GIF は密度の対象外。webp モードでは変換だけされる
    ['webp', 2, 'img/a.gif', ['/proj/dist/img/a.webp']],
    ['compress', 2, 'img/a.gif', ['/proj/dist/img/a.gif']]
  ])('imageOptimization: %s / density %i のとき %s -> %j', (optimization, density, relativePath, expected) => {
    expect(imageOutputPaths(relativePath, config(optimization, density), paths).map(out => out.absolute)).toEqual(
      expected
    )
  })

  it('筆頭は必ず原寸（削除側が「このソースの出力」として頼る）', () => {
    const [first] = imageOutputPaths('img/a.jpg', config('webp', 2), paths)
    expect(first).toMatchObject({ relative: 'img/a.webp', density: 2 })
  })
})
