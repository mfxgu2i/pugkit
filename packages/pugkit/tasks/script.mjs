import { glob } from 'glob'
import { resolve, relative, dirname } from 'node:path'
import * as esbuild from 'esbuild'
import { logger } from '../utils/logger.mjs'
import { ensureDir } from '../utils/file.mjs'

/**
 * esbuild（TypeScript/JavaScript）ビルドタスク
 */
export async function scriptTask(context, options = {}) {
  const { paths, isProduction, config } = context

  // 1. ビルド対象ファイルの取得
  const scriptFiles = await glob('**/[^_]*.{ts,js}', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/*.d.ts', '**/node_modules/**']
  })

  if (scriptFiles.length === 0) {
    logger.skip('script', 'No files to build')
    return
  }

  logger.info('script', `Building ${scriptFiles.length} file(s)`)

  // debugモードはdevモード時のみ有効
  const isDebugMode = !isProduction && config.debug

  try {
    // 2. esbuild設定
    const config = {
      entryPoints: scriptFiles,
      outdir: paths.dist,
      outbase: paths.src,
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      splitting: false,
      write: true,
      sourcemap: isDebugMode,
      minify: false,
      metafile: false,
      logLevel: 'error',
      keepNames: false,
      external: [],
      plugins: [],
      legalComments: 'none',
      treeShaking: true,
      minifyWhitespace: !isDebugMode,
      minifySyntax: !isDebugMode
    }

    // debugモードでない場合はconsole/debuggerを削除
    if (!isDebugMode) {
      config.drop = ['console', 'debugger']
    }

    // 3. ビルド実行
    await ensureDir(paths.dist)
    const result = await esbuild.build(config)

    if (result.errors && result.errors.length > 0) {
      throw new Error(`esbuild errors: ${result.errors.length}`)
    }

    logger.success('script', `Built ${scriptFiles.length} file(s)`)
  } catch (error) {
    logger.error('script', error.message)
    throw error
  }
}

export default scriptTask
