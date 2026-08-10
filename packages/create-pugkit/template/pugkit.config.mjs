import { defineConfig } from 'pugkit'

// See: https://github.com/mfxgu2i/pugkit/blob/main/packages/pugkit/README.md#configuration
export default defineConfig({
  siteUrl: 'https://example.com/',
  subdir: '',
  outDir: 'dist',
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    image: {
      // 'avif' | 'webp' | 'compress'
      format: 'webp',
      // src の画像を何倍の原本として扱うか。2 なら等倍版を生成して srcset を出す
      sourceDensity: 2
    }
  }
})
