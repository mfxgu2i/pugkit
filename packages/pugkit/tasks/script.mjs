import { glob } from 'glob'
import { resolve, relative, dirname, basename } from 'node:path'
import * as esbuild from 'esbuild'
import { logger } from '../utils/logger.mjs'
import { ensureDir } from '../utils/file.mjs'

/**
 * esbuild（TypeScript/JavaScript）ビルドタスク
 */
export async function scriptTask(context, options = {}) {
  const { paths, isProduction, isDevelopment, config, scriptGraph } = context

  // 1. ビルド対象ファイルの取得
  const allEntryFiles = await glob('**/[^_]*.{ts,js}', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/*.d.ts', '**/node_modules/**']
  })

  if (allEntryFiles.length === 0) {
    logger.skip('script', 'No files to build')
    return
  }

  // 2. dev モードでのインクリメンタルビルド
  let filesToBuild = allEntryFiles

  if (isDevelopment && options.files?.length > 0) {
    const changedFile = options.files[0]
    const isPartial = basename(changedFile).startsWith('_')

    if (isPartial) {
      // パーシャル変更 → 依存グラフから影響を受けるエントリファイルを特定
      const affected = scriptGraph.getAffectedParents(changedFile)
      filesToBuild = affected.filter(f => allEntryFiles.includes(f))

      if (filesToBuild.length === 0) {
        // グラフにまだ情報がない場合はフルビルド
        filesToBuild = allEntryFiles
      } else {
        logger.info('script', `Partial changed, rebuilding ${filesToBuild.length} affected file(s)`)
      }
    } else if (allEntryFiles.includes(changedFile)) {
      // 非パーシャルのエントリファイル → そのファイルだけリビルド
      filesToBuild = [changedFile]
    }
  }

  logger.info('script', `Building ${filesToBuild.length} file(s)`)

  // debugモードはdevモード時のみ有効
  const isDebugMode = !isProduction && config.debug

  try {
    // 3. esbuild設定
    const esbuildConfig = {
      entryPoints: filesToBuild,
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
      metafile: true,
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
      esbuildConfig.drop = ['console', 'debugger']
    }

    // 4. ビルド実行
    await ensureDir(paths.dist)
    const result = await esbuild.build(esbuildConfig)

    if (result.errors && result.errors.length > 0) {
      throw new Error(`esbuild errors: ${result.errors.length}`)
    }

    // 5. 依存グラフを更新（metafile から依存関係を構築）
    if (result.metafile) {
      for (const [output, meta] of Object.entries(result.metafile.outputs)) {
        if (!meta.entryPoint) continue
        const entryPath = resolve(paths.root, meta.entryPoint)

        scriptGraph.clearDependencies(entryPath)

        for (const inputPath of Object.keys(meta.inputs)) {
          const absInputPath = resolve(paths.root, inputPath)
          if (absInputPath !== entryPath) {
            scriptGraph.addDependency(entryPath, absInputPath)
          }
        }
      }
    }

    logger.success('script', `Built ${filesToBuild.length} file(s)`)
  } catch (error) {
    logger.error('script', error.message)
    throw error
  }
}

export default scriptTask
