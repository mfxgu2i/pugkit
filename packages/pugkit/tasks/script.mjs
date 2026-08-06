import { glob } from 'glob'
import { resolve, relative, dirname, basename } from 'node:path'
import * as esbuild from 'esbuild'
import { logger } from '../utils/logger.mjs'
import { ensureDir } from '../utils/file.mjs'

// dev では esbuild の incremental build コンテキストをエントリ構成ごとに使い回し、
// 同じファイルの連続編集でモジュールグラフを再利用する（プロセス終了時に自動破棄される）
let _devCtx = null
let _devCtxKey = null
// watcher のイベントは直列化されないため、dev ビルドをキューで直列化して
// dispose 済み context への rebuild や context の二重生成を防ぐ
let _devBuildQueue = Promise.resolve()

function enqueueDevBuild(fn) {
  const run = _devBuildQueue.then(fn, fn)
  _devBuildQueue = run.catch(() => {})
  return run
}

async function getDevContext(esbuildConfig) {
  const key = [...esbuildConfig.entryPoints].sort().join('\n')
  if (!_devCtx || _devCtxKey !== key) {
    if (_devCtx) {
      const old = _devCtx
      _devCtx = null
      _devCtxKey = null
      await old.dispose()
    }
    _devCtx = await esbuild.context(esbuildConfig)
    _devCtxKey = key
  }
  return _devCtx
}

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

  // dev は常に非圧縮 + ソースマップ、production は常に圧縮
  const isDevBuild = !isProduction

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
      sourcemap: isDevBuild,
      minify: false,
      metafile: true,
      logLevel: 'error',
      keepNames: false,
      external: [],
      plugins: [],
      legalComments: 'none',
      treeShaking: true,
      minifyWhitespace: !isDevBuild,
      minifySyntax: !isDevBuild
    }

    // production はconsole/debuggerを削除
    if (!isDevBuild) {
      esbuildConfig.drop = ['console', 'debugger']
    }

    // 4. ビルド実行（dev はコンテキスト再利用の増分ビルド、build は従来どおり単発実行）
    await ensureDir(paths.dist)
    const result = isDevelopment
      ? await enqueueDevBuild(async () => (await getDevContext(esbuildConfig)).rebuild())
      : await esbuild.build(esbuildConfig)

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
