import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm, stat, readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { imageTask } from '../../tasks/image.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const testDataDir = resolve(__dirname, '../_data/image-task')
const srcDir = resolve(testDataDir, 'src')
const distDir = resolve(testDataDir, 'dist')

async function createJpeg(filePath, width = 200, height = 150) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } }
  })
    .jpeg({ quality: 100 })
    .toFile(filePath)
}

function makeContext(overrides = {}) {
  return {
    paths: { src: srcDir, dist: distDir },
    config: {
      build: {
        imageOptimization: 'webp',
        imageOptions: {
          webp: { quality: 30, effort: 0, lossless: false },
          jpeg: { quality: 30 },
          png: { quality: 30, compressionLevel: 9 },
          avif: { quality: 30, effort: 0 }
        },
        imageOverrides: overrides
      }
    },
    isProduction: true
  }
}

beforeAll(async () => {
  await mkdir(srcDir, { recursive: true })
  await mkdir(distDir, { recursive: true })
  await createJpeg(resolve(srcDir, 'normal.jpg'))
  await createJpeg(resolve(srcDir, 'mv.jpg'))
})

afterAll(async () => {
  await rm(testDataDir, { recursive: true, force: true })
})

describe('imageTask / imageOverrides', () => {
  it('overrides なし: 低 quality (30) で出力される', async () => {
    const context = makeContext({})
    await imageTask(context)

    const normalSize = (await stat(resolve(distDir, 'normal.webp'))).size
    const mvSize = (await stat(resolve(distDir, 'mv.webp'))).size

    // どちらも低 quality なので小さい
    expect(normalSize).toBeGreaterThan(0)
    expect(mvSize).toBeGreaterThan(0)

    // サイズを後続テストと比較するために保存
    context._normalSize = normalSize
    context._mvSize = mvSize
  })

  it('mv.jpg だけ quality: 100 を指定すると normal より大きくなる', async () => {
    // 一度クリアして再生成
    await rm(distDir, { recursive: true, force: true })
    await mkdir(distDir, { recursive: true })

    const context = makeContext({
      'mv.jpg': { quality: 100 }
    })
    await imageTask(context)

    const normalSize = (await stat(resolve(distDir, 'normal.webp'))).size
    const mvSize = (await stat(resolve(distDir, 'mv.webp'))).size

    // mv.jpg は quality:100、normal.jpg は quality:30
    // 同じ画像サイズ (200x150) なので quality の差がファイルサイズに現れる
    expect(mvSize).toBeGreaterThan(normalSize)
  })

  it('mv.jpg だけ lossless: true を指定すると lossless WebP で出力される', async () => {
    await rm(distDir, { recursive: true, force: true })
    await mkdir(distDir, { recursive: true })

    const context = makeContext({
      'mv.jpg': { lossless: true }
    })
    await imageTask(context)

    // WebP ファイルバイトシグネチャで lossless/lossy を判別
    // lossy  WebP: offset 12-15 = "VP8 " (スペースあり)
    // lossless WebP: offset 12-15 = "VP8L"
    const normalBuf = await readFile(resolve(distDir, 'normal.webp'))
    const mvBuf = await readFile(resolve(distDir, 'mv.webp'))

    const getWebpChunkId = buf => buf.slice(12, 16).toString('ascii')

    expect(getWebpChunkId(normalBuf)).toBe('VP8 ') // lossy (quality:30)
    expect(getWebpChunkId(mvBuf)).toBe('VP8L') // lossless
  })

  it('avif モードでも特定画像の overrides が適用される', async () => {
    await rm(distDir, { recursive: true, force: true })
    await mkdir(distDir, { recursive: true })

    const context = makeContext({ 'mv.jpg': { quality: 100 } })
    context.config.build.imageOptimization = 'avif'
    context.config.build.imageOptions.avif = { quality: 10, effort: 0 }

    await imageTask(context)

    const normalSize = (await stat(resolve(distDir, 'normal.avif'))).size
    const mvSize = (await stat(resolve(distDir, 'mv.avif'))).size

    expect(mvSize).toBeGreaterThan(normalSize)
  })
})
