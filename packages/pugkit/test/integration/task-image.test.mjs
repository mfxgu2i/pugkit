import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { stat, readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { imageOutputPath, imageTask } from '../../tasks/image.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * 画像タスク。imageOverrides でファイル単位に変換設定を上書きできることと、
 * imageOptimization の各モードで出力形式が変わることを固定する。
 */
let project
let srcDir
let distDir

async function createJpeg(filePath, width = 200, height = 150) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } }
  })
    .jpeg({ quality: 100 })
    .toFile(filePath)
}

function makeContext({ overrides = {}, optimization = 'webp', imageOptions = {} } = {}) {
  return {
    paths: { src: srcDir, output: distDir },
    config: {
      build: {
        imageOptimization: optimization,
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
  project = await createTempProject({ 'src/.keep': '', 'dist/.keep': '' })
  srcDir = project.path('src')
  distDir = project.path('dist')
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
})

describe('imageOptimization', () => {
  it('webp は .webp に変換する', async () => {
    await imageTask(makeContext({ optimization: 'webp' }))
    expect(await listFiles(distDir)).toEqual(expect.arrayContaining(['normal.webp', 'mv.webp']))
  })

  it('false でも変換せずコピーする（HTML から参照されるため）', async () => {
    await imageTask(makeContext({ optimization: false }))

    const output = await listFiles(distDir)
    expect(output).toEqual(expect.arrayContaining(['normal.jpg', 'mv.jpg']))
    expect(output.filter(f => f.endsWith('.webp'))).toEqual([])
  })
})

describe('出力先の規則', () => {
  /**
   * 生成側と、watcher の削除側で規則がずれると、
   * 消したはずの画像が配信され続ける（スプライトで実際に起きた形）。
   * 規則は imageOutputPath 一つに集約し、両方から使う。
   */
  const paths = { src: '/proj/src', output: '/proj/dist' }

  it.each([
    ['webp', 'img/a.jpg', '/proj/dist/img/a.webp'],
    ['webp', 'img/a.PNG', '/proj/dist/img/a.webp'],
    ['avif', 'img/a.jpg', '/proj/dist/img/a.avif'],
    ['compress', 'img/a.jpg', '/proj/dist/img/a.jpg'],
    ['copy', 'img/a.png', '/proj/dist/img/a.png']
  ])('imageOptimization: %s のとき %s -> %s', (optimization, relativePath, expected) => {
    expect(imageOutputPath(relativePath, optimization, paths)).toBe(expected)
  })
})
