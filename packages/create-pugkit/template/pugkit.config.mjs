import { defineConfig } from 'pugkit'

// See: https://github.com/mfxgu2i/pugkit/blob/main/packages/pugkit/README.md#configuration
export default defineConfig({
  siteUrl: 'https://example.com/',
  subdir: '',
  outDir: 'dist',
  debug: false,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    // 'avif' | 'webp' | 'compress' | false
    imageOptimization: 'webp',
    imageOptions: {
      avif: {
        quality: 70,
        lossless: false,
        effort: 4,
        chromaSubsampling: '4:4:4'
      },
      webp: {
        quality: 80,
        effort: 4,
        smartSubsample: true,
        alphaQuality: 100,
        lossless: false
      },
      jpeg: {
        quality: 75,
        progressive: true,
        mozjpeg: false
      },
      png: {
        quality: 85,
        compressionLevel: 6,
        adaptiveFiltering: true,
        palette: true
      }
    }
  }
})
