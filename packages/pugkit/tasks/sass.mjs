import { glob } from 'glob'
import { writeFile } from 'node:fs/promises'
import { relative, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass-embedded'
import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'
import { logger } from '../utils/logger.mjs'
import { resolveRebuildTargets } from '../utils/rebuild-targets.mjs'
import { ensureFileDir } from '../utils/file.mjs'

const SASS_COMPILER = 'sass:compiler'

/**
 * dev で常駐させる Embedded Sass のコンパイラ。
 * 再コンパイルごとのプロセス起動コストを避ける。
 *
 * セッション（BuildContext）ごとに1つ。context.resources が寿命を持つ
 */
class DevSassCompiler {
  constructor() {
    this.pending = null
  }

  compiler() {
    if (!this.pending) {
      const pending = sass.initAsyncCompiler()
      // 初期化失敗を永続キャッシュせず、次回の呼び出しで再試行できるようにする。
      // 自分がまだ現役のときだけ捨てる。遅れて失敗した古い初期化が、
      // その後に作られたコンパイラを取り違えて捨てないようにする
      pending.catch(() => {
        if (this.pending === pending) this.pending = null
      })
      this.pending = pending
    }
    return this.pending
  }

  /**
   * 常駐コンパイラを終了する。プロセスを抱えたままだと dev を止めても終われない。
   * 参照を捨てるので、次に使うときは初期化からやり直す
   */
  async dispose() {
    const pending = this.pending
    this.pending = null
    if (!pending) return

    try {
      await (await pending).dispose()
    } catch {
      // 初期化に失敗していた場合。破棄すべきものが無いので何もしない
    }
  }
}

function getDevCompiler(context) {
  return context.resources.get(SASS_COMPILER, () => new DevSassCompiler()).compiler()
}

/**
 * Sass の出力先。生成側と watcher の削除側で規則がずれないよう共有する
 */
export function sassOutputPath(relativePath, paths) {
  return resolve(paths.output, relativePath.replace(/\.scss$/, '.css'))
}

/**
 * Sassビルドタスク
 */
export async function sassTask(context, options = {}) {
  const { paths, isProduction, isDevelopment, sassGraph } = context

  // dev は常に非圧縮 + ソースマップ、production は常に圧縮
  const isDevBuild = !isProduction

  // 1. ビルド対象ファイルの取得（非パーシャル）
  const allEntryFiles = await glob('**/[^_]*.scss', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*.scss', '**/_*/**']
  })

  if (allEntryFiles.length === 0) {
    logger.skip('sass', 'No files to build')
    return
  }

  // 2. dev モードでのインクリメンタルビルド
  let filesToBuild = allEntryFiles

  if (isDevelopment && options.changed) {
    filesToBuild = resolveRebuildTargets(options.changed, allEntryFiles, sassGraph)

    if (filesToBuild.length === 0) {
      logger.skip('sass', 'No entry depends on the changed file')
      return
    }
  }

  logger.info('sass', `Building ${filesToBuild.length} file(s)`)

  // 3. 並列コンパイル（dev は常駐コンパイラを再利用、build は使い捨てで確実に破棄）
  //
  // ここは同時実行数を絞らない。対象はパーシャルを除いたエントリだけで元々少なく、
  // 多重化は常駐コンパイラ側が持っている。ファイル数がそのまま並列数になる
  // image / svg / copy とは事情が違う（utils/concurrency.mjs を参照）
  const compiler = isDevelopment ? await getDevCompiler(context) : await sass.initAsyncCompiler()

  try {
    await Promise.all(filesToBuild.map(file => compileSassFile(file, context, isDevBuild, compiler)))
  } finally {
    if (!isDevelopment) await compiler.dispose()
  }

  logger.success('sass', `Built ${filesToBuild.length} file(s)`)
}

/**
 * 個別Sassファイルのコンパイル
 */
async function compileSassFile(filePath, context, isDevBuild, compiler) {
  const { paths, config, sassGraph } = context

  try {
    // Sassコンパイル
    const result = await compiler.compileAsync(filePath, {
      silenceDeprecations: ['legacy-js-api'],
      style: isDevBuild ? 'expanded' : 'compressed',
      loadPaths: [resolve(paths.root, 'node_modules')],
      charset: false,
      quietDeps: true,
      sourceMap: isDevBuild,
      sourceMapIncludeSources: isDevBuild
    })

    // 依存グラフを更新（loadedUrls からパーシャルの依存関係を構築）
    sassGraph.clearDependencies(filePath)
    if (result.loadedUrls) {
      for (const url of result.loadedUrls) {
        if (url.protocol === 'file:') {
          const depPath = fileURLToPath(url)
          if (depPath !== filePath) {
            sassGraph.addDependency(filePath, depPath)
          }
        }
      }
    }

    let css = result.css

    // PostCSS処理
    const postcssPlugins = [autoprefixer()]

    // production は常にminify
    if (!isDevBuild) {
      postcssPlugins.push(
        cssnano({
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
              colormin: true,
              minifySelectors: true,
              calc: false
            }
          ]
        })
      )
    }

    const outputPath = sassOutputPath(relative(paths.src, filePath), paths)

    const postcssResult = await postcss(postcssPlugins).process(css, {
      from: filePath,
      to: outputPath,
      map: isDevBuild ? { inline: false, annotation: true } : false
    })

    css = postcssResult.css

    // 出力
    await ensureFileDir(outputPath)
    await writeFile(outputPath, css, 'utf8')

    // dev はソースマップを出力
    if (isDevBuild && postcssResult.map) {
      const mapPath = `${outputPath}.map`
      await writeFile(mapPath, postcssResult.map.toString(), 'utf8')
    }
  } catch (error) {
    logger.error('sass', `Failed to compile ${basename(filePath)}: ${error.message}`)
    throw error
  }
}

export default sassTask
