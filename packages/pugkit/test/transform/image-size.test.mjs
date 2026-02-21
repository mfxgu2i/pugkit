import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { createImageInfoHelper } from '../../transform/image-size.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const testDataDir = resolve(__dirname, '../_data')
const imagesDir = resolve(testDataDir, 'images')

// imageInfo の src 引数は pugファイルの処理時に渡す相対パス or /始まりパス
// /始まりの場合は paths.src からの絶対解決になる
const mockPugFile = resolve(testDataDir, 'index.pug')

const paths = {
  src: testDataDir,
  public: resolve(testDataDir, 'public')
}

const webpConfig = { build: { imageOptimization: 'webp' } }
const compressConfig = { build: { imageOptimization: 'compress' } }
const noOptConfig = { build: { imageOptimization: false } }

async function createJpeg(filePath, width = 100, height = 80) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 120, b: 120 } }
  })
    .jpeg()
    .toFile(filePath)
}

beforeAll(async () => {
  await mkdir(imagesDir, { recursive: true })
  // 基本画像
  await createJpeg(resolve(imagesDir, 'hero.jpg'), 800, 600)
  // retina
  await createJpeg(resolve(imagesDir, 'hero@2x.jpg'), 1600, 1200)
  // SP
  await createJpeg(resolve(imagesDir, 'responsive.jpg'), 800, 600)
  await createJpeg(resolve(imagesDir, 'responsive_sp.jpg'), 375, 300)
  // SVG
  await writeFile(
    resolve(imagesDir, 'icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"></svg>'
  )
})

afterAll(async () => {
  await rm(imagesDir, { recursive: true, force: true })
})

describe('createImageInfoHelper', () => {
  describe('基本情報の取得', () => {
    it('width / height / format を返す', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.width).toBe(800)
      expect(result.height).toBe(600)
      expect(result.format).toBe('jpg')
      expect(result.isSvg).toBe(false)
    })

    it('ファイルが存在しない場合は fallback を返す', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/not-found.jpg')
      expect(result.src).toBe('/images/not-found.jpg')
      expect(result.width).toBeUndefined()
      expect(result.height).toBeUndefined()
      expect(result.retina).toBeNull()
      expect(result.sp).toBeNull()
    })
  })

  describe('src のパス解決', () => {
    it('imageOptimization: webp のとき src が .webp パスになる', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.src).toBe('/images/hero.webp')
    })

    it('imageOptimization: compress のとき src は元パスのまま', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, compressConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.src).toBe('/images/hero.jpg')
    })

    it('imageOptimization: false のとき src は元パスのまま', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, noOptConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.src).toBe('/images/hero.jpg')
    })
  })

  describe('retina 自動検出', () => {
    it('hero@2x.jpg が存在する場合 retina.src が webp パスになる (webp モード)', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.retina).not.toBeNull()
      expect(result.retina.src).toBe('/images/hero@2x.webp')
    })

    it('@2x が存在しない場合 retina は null', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/responsive.jpg')
      expect(result.retina).toBeNull()
    })

    it('compress モードのとき retina.src は元パス', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, compressConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.retina).not.toBeNull()
      expect(result.retina.src).toBe('/images/hero@2x.jpg')
    })
  })

  describe('SP 画像自動検出', () => {
    it('responsive_sp.jpg が存在する場合 sp.src が webp パスになる (webp モード)', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/responsive.jpg')
      expect(result.sp).not.toBeNull()
      expect(result.sp.src).toBe('/images/responsive_sp.webp')
      expect(result.sp.width).toBe(375)
      expect(result.sp.height).toBe(300)
    })

    it('_sp が存在しない場合 sp は null', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/hero.jpg')
      expect(result.sp).toBeNull()
    })

    it('compress モードのとき sp.src は元パス', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, compressConfig)
      const result = imageInfo('/images/responsive.jpg')
      expect(result.sp).not.toBeNull()
      expect(result.sp.src).toBe('/images/responsive_sp.jpg')
    })
  })

  describe('SVG', () => {
    it('isSvg: true / retina: null / sp: null、src は変換されない', () => {
      const imageInfo = createImageInfoHelper(mockPugFile, paths, null, webpConfig)
      const result = imageInfo('/images/icon.svg')
      expect(result.isSvg).toBe(true)
      expect(result.src).toBe('/images/icon.svg')
      expect(result.retina).toBeNull()
      expect(result.sp).toBeNull()
    })
  })
})
