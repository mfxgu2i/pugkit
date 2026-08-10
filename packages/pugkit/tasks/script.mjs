import { glob } from 'glob'
import { resolve } from 'node:path'
import * as esbuild from 'esbuild'
import { writeFile } from 'node:fs/promises'
import { logger } from '../utils/logger.mjs'
import { resolveRebuildTargets } from '../utils/rebuild-targets.mjs'
import { ensureDir, ensureFileDir } from '../utils/file.mjs'

const SCRIPT_BUILDER = 'script:builder'

/**
 * dev で常駐させる esbuild の incremental build コンテキスト。
 * 同じファイルの連続編集でモジュールグラフを再利用する。
 *
 * セッション（BuildContext）ごとに1つ。context.resources が寿命を持つ
 */
class DevScriptBuilder {
  constructor() {
    this.ctx = null
    this.key = null
    // 破棄後に作り直さないための印。キューに積まれたビルドは dispose を追い越せるので、
    // これが無いと「捨てたあとに生まれ、二度と捨てられない」esbuild プロセスが残る
    this.disposed = false
    // watcher のイベントは直列化されないため、dev ビルドをキューで直列化して
    // dispose 済み context への rebuild や context の二重生成を防ぐ
    this.queue = Promise.resolve()
  }

  rebuild(esbuildConfig) {
    return this.enqueue(async () => (await this.contextFor(esbuildConfig)).rebuild())
  }

  enqueue(fn) {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => {})
    return run
  }

  /** エントリ構成が変わったら作り直す。増減したエントリは既存の context では扱えない */
  async contextFor(esbuildConfig) {
    if (this.disposed) throw new Error('dev のビルドコンテキストは破棄済みです')

    const key = [...esbuildConfig.entryPoints].sort().join('\n')
    if (!this.ctx || this.key !== key) {
      const old = this.ctx
      this.ctx = null
      this.key = null
      if (old) await old.dispose()

      this.ctx = await esbuild.context(esbuildConfig)
      this.key = key
    }
    return this.ctx
  }

  /**
   * 常駐ビルドコンテキストを破棄する。プロセスを抱えたままだと dev を止めても終われない。
   * 参照を捨てるので、次に使うときは作り直しになる
   */
  async dispose() {
    this.disposed = true

    const ctx = this.ctx
    this.ctx = null
    this.key = null
    if (ctx) await ctx.dispose()
  }
}

function getDevBuilder(context) {
  return context.resources.get(SCRIPT_BUILDER, () => new DevScriptBuilder())
}

/**
 * JS の出力先。esbuild が書く側と watcher の削除側で規則がずれないよう共有する
 */
export function scriptOutputPath(relativePath, paths) {
  return resolve(paths.output, relativePath.replace(/\.ts$/, '.js'))
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

  if (isDevelopment && options.changed) {
    filesToBuild = resolveRebuildTargets(options.changed, allEntryFiles, scriptGraph)

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
      ? await getDevBuilder(context).rebuild(esbuildConfig)
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
