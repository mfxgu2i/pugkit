export const defaultConfig = {
  siteUrl: '',
  subdir: '',
  outDir: 'dist',
  debug: false,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/',
    open: false
  },
  build: {
    imageOptimization: 'webp',
    imageOptions: {
      webp: {
        quality: 90,
        effort: 6,
        smartSubsample: true,
        method: 6,
        reductionEffort: 6,
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
}
