import { defineConfig } from 'vitest/config'

// テストは「速度＝回せる頻度」で層別する。
//   unit        … I/O なし。TDD の赤→緑ループはここを watch で回す
//   integration … 一時プロジェクト or dev サーバー。数十〜数百ms
//   e2e         … createBuilder 経由のフルビルド。1件あたり ~1s
const base = {
  exclude: ['**/node_modules/**', '**/dist/**'],
  testTimeout: 20000
}

export default defineConfig({
  test: {
    projects: [
      {
        test: { ...base, name: 'unit', include: ['./packages/pugkit/test/unit/**/*.test.{js,mjs}'] }
      },
      {
        test: { ...base, name: 'integration', include: ['./packages/pugkit/test/integration/**/*.test.{js,mjs}'] }
      },
      {
        test: { ...base, name: 'e2e', include: ['./packages/pugkit/test/e2e/**/*.test.{js,mjs}'] }
      }
    ]
  },
  esbuild: {
    target: 'node18'
  }
})
