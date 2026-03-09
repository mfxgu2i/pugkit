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
    imageOptimization: 'webp'
  }
})
