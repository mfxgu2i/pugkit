import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { stat, readFile, writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { imageOutputPaths, imageTask } from '../../tasks/image.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * 画像タスク。build.image.overrides でファイル単位に変換設定を上書きできることと、
 * build.image の format / sourceDensity の組み合わせで出力が変わることを固定する。
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

function makeContext({ overrides = {}, format = 'webp', imageOptions = {}, density = 1 } = {}) {
  return {
    paths: { src: srcDir, output: distDir, public: publicDir },
    config: {
      build: {
        image: {
          format,
          sourceDensity: density,
          options: {
            webp: { quality: 30, effort: 0, lossless: false },
            jpeg: { quality: 30 },
            png: { quality: 30, compressionLevel: 9 },
            avif: { quality: 30, effort: 0 },
            ...imageOptions
          },
          overrides
        }
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

describe('build.image.overrides', () => {
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
        format: 'avif',
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

describe('build.image.format', () => {
  it('webp は .webp に変換する', async () => {
    await imageTask(makeContext({ format: 'webp' }))
    expect(await listFiles(distDir)).toEqual(expect.arrayContaining(['normal.webp', 'mv.webp']))
  })

  it('compress は元の形式のまま出力する', async () => {
    await imageTask(makeContext({ format: 'compress' }))

    const output = await listFiles(distDir)
    expect(output).toEqual(expect.arrayContaining(['normal.jpg', 'mv.jpg']))
    expect(output.filter(f => f.endsWith('.webp'))).toEqual([])
  })
})

describe('build.image.sourceDensity', () => {
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

    await imageTask(makeContext({ density: 2, format: 'compress' }))

    expect(await readFile(resolve(distDir, 'anim.gif'))).toEqual(await readFile(source))
  })
})

describe('変換対象外の画像', () => {
  /**
   * .webp / .avif は image タスクの対象でも svg タスクの対象でもなく、
   * copy は public しか見ないため出力に出ない。それでも imageInfo() は
   * 寸法を読んで参照を書くので、黙っていると無警告のリンク切れになる
   */
  it('src に置かれていても出力しない', async () => {
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#0a0' } })
      .webp()
      .toFile(resolve(srcDir, 'photo.webp'))

    await imageTask(makeContext({ density: 2 }))

    const output = await listFiles(distDir)
    // 前提: 他の画像は処理されている
    expect(output).toContain('normal.webp')
    expect(output).not.toContain('photo.webp')
  })

  it('出力されないことを警告する', async () => {
    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#0a0' } })
      .webp()
      .toFile(resolve(srcDir, 'photo.webp'))

    const logs = []
    await withCapturedLogs(logs, () => imageTask(makeContext({ density: 2 })))

    expect(logs.join('\n')).toMatch(/photo\.webp/)
    expect(logs.join('\n')).toMatch(/public/)
  })

  it('無ければ警告しない', async () => {
    const logs = []
    await withCapturedLogs(logs, () => imageTask(makeContext({ density: 2 })))

    expect(logs.join('\n')).not.toMatch(/変換対象外/)
  })

  /**
   * 変換対象が 1 枚も無いときこそ警告が要る。src に .webp しか置いていない状況が
   * まさにそれで、「何も出力されないのに無警告」が一番起きやすい。
   *
   * 他の画像と同居している場合しか試していないと、早期リターンの後ろに
   * 警告を置いてしまっても気づけない。
   */
  it('変換対象が 1 枚も無くても警告する', async () => {
    const only = await createTempProject({ 'src/.keep': '', 'dist/.keep': '', 'public/.keep': '' })
    srcDir = only.path('src')
    distDir = only.path('dist')
    publicDir = only.path('public')

    await sharp({ create: { width: 20, height: 10, channels: 3, background: '#0a0' } })
      .webp()
      .toFile(resolve(srcDir, 'only.webp'))

    const logs = []
    await withCapturedLogs(logs, () => imageTask(makeContext({ density: 2 })))

    expect(logs.join('\n')).toMatch(/only\.webp/)
  })
})

describe('出力先の規則', () => {
  /**
   * 生成側と、watcher の削除側で規則がずれると、
   * 消したはずの画像が配信され続ける（スプライトで実際に起きた形）。
   * 規則は imageOutputPaths 一つに集約し、両方から使う。
   */
  const paths = { src: '/proj/src', output: '/proj/dist', public: '/proj/public' }
  const config = (format, density) => ({
    build: { image: { format, sourceDensity: density } }
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
  ])('build.image.format: %s / density %i のとき %s -> %j', (format, density, relativePath, expected) => {
    expect(imageOutputPaths(relativePath, config(format, density), paths).map(out => out.absolute)).toEqual(expected)
  })

  it('筆頭は必ず原寸（削除側が「このソースの出力」として頼る）', () => {
    const [first] = imageOutputPaths('img/a.jpg', config('webp', 2), paths)
    expect(first).toMatchObject({ relative: 'img/a.webp', density: 2 })
  })
})

/** logger は console.log に出すので、そちらを横取りする */
async function withCapturedLogs(sink, fn) {
  const original = console.log
  console.log = (...args) => sink.push(args.join(' '))
  try {
    await fn()
  } finally {
    console.log = original
  }
}
