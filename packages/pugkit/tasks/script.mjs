import { glob } from 'glob'
import { resolve } from 'node:path'
import * as esbuild from 'esbuild'
import { writeFile } from 'node:fs/promises'
import { logger } from '../utils/logger.mjs'
import { resolveRebuildTargets } from '../utils/rebuild-targets.mjs'
import { ensureDir, ensureFileDir } from '../utils/file.mjs'

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
 * 常駐ビルドコンテキストを破棄する。プロセスを抱えたままだと dev を止めても終われない。
 * 参照を捨てるので、次に使うときは作り直しになる
 */
export async function disposeDevContext() {
  const ctx = _devCtx
  _devCtx = null
  _devCtxKey = null
  if (ctx) await ctx.dispose()
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
    ignore: ['**/*.d.ts', '**/node_modules/**', '**/_*/**']
  })

  if (allEntryFiles.length === 0) {
    logger.skip('script', 'No files to build')
    return
  }

  // 2. dev モードでのインクリメンタルビルド
  let filesToBuild = allEntryFiles

  if (isDevelopment && options.files?.length > 0) {
    filesToBuild = resolveRebuildTargets(options.files[0], allEntryFiles, scriptGraph)

    if (filesToBuild.length === 0) {
      logger.skip('script', 'No entry depends on the changed file')
      return
    }
  }

  logger.info('script', `Building ${filesToBuild.length} file(s)`)

  // dev は常に非圧縮 + ソースマップ、production は常に圧縮
  const isDevBuild = !isProduction

  try {
    // 3. esbuild設定
    const esbuildConfig = {
      entryPoints: filesToBuild,
      outdir: paths.output,
      outbase: paths.src,
      // metafile のパスはここを基準にした相対パスになる。既定はプロセスの作業
      // ディレクトリなので、指定しないと CLI 以外の使い方で依存グラフが壊れる
      absWorkingDir: paths.root,
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      splitting: false,
      // dev は自前で書き出す。esbuild に任せるとインクリメンタルビルドの失敗時に
      // 出力ファイルが削除され、構文エラーの最中だけ JS が 404 になってしまう
      write: !isDevelopment,
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
    await ensureDir(paths.output)
    const result = isDevelopment
      ? await enqueueDevBuild(async () => (await getDevContext(esbuildConfig)).rebuild())
      : await esbuild.build(esbuildConfig)

    if (result.errors && result.errors.length > 0) {
      throw new Error(`esbuild errors: ${result.errors.length}`)
    }

    // dev のみ: ビルドが成功したものだけを書き出す（失敗時は前回の出力を残す）
    if (isDevelopment && result.outputFiles) {
      for (const file of result.outputFiles) {
        await ensureFileDir(file.path)
        await writeFile(file.path, file.contents)
      }
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
