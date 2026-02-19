import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['./packages/pugkit/test/**/*.test.{js,mjs}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20000
  },
  esbuild: {
    target: 'node18'
  }
})
