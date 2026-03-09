import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../../config/defaults.mjs'

describe('defaultConfig', () => {
  it('should have correct default values', () => {
    expect(defaultConfig.siteUrl).toBe('')
    expect(defaultConfig.subdir).toBe('')
    expect(defaultConfig.outDir).toBe('dist')
    expect(defaultConfig.debug).toBe(false)
  })

  it('should have server configuration', () => {
    expect(defaultConfig.server).toBeDefined()
    expect(defaultConfig.server.port).toBe(5555)
    expect(defaultConfig.server.host).toBe('localhost')
    expect(defaultConfig.server.startPath).toBe('/')
  })

  it('should have build configuration', () => {
    expect(defaultConfig.build).toBeDefined()
    expect(defaultConfig.build.clean).toBe(true)
    expect(defaultConfig.build.imageOptimization).toBe('webp')
    expect(defaultConfig.build.imageOptions).toBeDefined()
  })

  it('should have webp image options', () => {
    const webpOptions = defaultConfig.build.imageOptions.webp
    expect(webpOptions.quality).toBe(80)
    expect(webpOptions.effort).toBe(4)
    expect(webpOptions.smartSubsample).toBe(true)
    expect(webpOptions.lossless).toBe(false)
  })

  it('should have jpeg image options', () => {
    const jpegOptions = defaultConfig.build.imageOptions.jpeg
    expect(jpegOptions.quality).toBe(75)
    expect(jpegOptions.progressive).toBe(true)
    expect(jpegOptions.mozjpeg).toBe(false)
  })

  it('should have png image options', () => {
    const pngOptions = defaultConfig.build.imageOptions.png
    expect(pngOptions.quality).toBe(85)
    expect(pngOptions.compressionLevel).toBe(6)
    expect(pngOptions.adaptiveFiltering).toBe(true)
    expect(pngOptions.palette).toBe(true)
  })

  it('should have avif image options', () => {
    const avifOptions = defaultConfig.build.imageOptions.avif
    expect(avifOptions).toBeDefined()
    expect(avifOptions.quality).toBe(70)
    expect(avifOptions.lossless).toBe(false)
    expect(avifOptions.effort).toBe(4)
    expect(avifOptions.chromaSubsampling).toBe('4:4:4')
  })

  it('should have empty imageOverrides by default', () => {
    expect(defaultConfig.build.imageOverrides).toBeDefined()
    expect(typeof defaultConfig.build.imageOverrides).toBe('object')
    expect(Object.keys(defaultConfig.build.imageOverrides)).toHaveLength(0)
  })

  it('should be an object', () => {
    expect(typeof defaultConfig).toBe('object')
    expect(defaultConfig).not.toBeNull()
  })
})
