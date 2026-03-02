import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as sass from 'sass'
import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

/**
 * Sassビルドタスク
 */
export async function sassTask(context, options = {}) {
  const { paths, config, isProduction, isDevelopment, sassGraph, cache } = context

  // debugモードはdevモード時のみ有効
  const isDebugMode = !isProduction && config.debug

  // 1. ビルド対象ファイルの取得（非パーシャル）
  const allEntryFiles = await glob('**/[^_]*.scss', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*.scss']
  })

  if (allEntryFiles.length === 0) {
    logger.skip('sass', 'No files to build')
    return
  }

  // 2. dev モードでのインクリメンタルビルド
  let filesToBuild = allEntryFiles

  if (isDevelopment && options.files?.length > 0) {
    const changedFile = options.files[0]
    const isPartial = basename(changedFile).startsWith('_')

    if (isPartial) {
      // パーシャル変更 → 依存グラフから影響を受けるエントリファイルを特定
      const affected = sassGraph.getAffectedParents(changedFile)
      filesToBuild = affected.filter(f => allEntryFiles.includes(f))

      if (filesToBuild.length === 0) {
        // グラフにまだ情報がない場合はフルビルド
        filesToBuild = allEntryFiles
      } else {
        logger.info('sass', `Partial changed, rebuilding ${filesToBuild.length} affected file(s)`)
      }
    } else {
      // 非パーシャル変更 → そのファイルだけリビルド
      filesToBuild = allEntryFiles.filter(f => f === changedFile)
      if (filesToBuild.length === 0) {
        logger.skip('sass', 'Changed file is not a build target')
        return
      }
    }
  }

  logger.info('sass', `Building ${filesToBuild.length} file(s)`)

  // 3. 並列コンパイル
  await Promise.all(filesToBuild.map(file => compileSassFile(file, context, isDebugMode)))

  logger.success('sass', `Built ${filesToBuild.length} file(s)`)
}

/**
 * 個別Sassファイルのコンパイル
 */
async function compileSassFile(filePath, context, isDebugMode) {
  const { paths, config, isProduction, sassGraph } = context

  try {
    // Sassコンパイル
    const result = sass.compile(filePath, {
      silenceDeprecations: ['legacy-js-api'],
      style: isDebugMode ? 'expanded' : 'compressed',
      loadPaths: [resolve(paths.root, 'node_modules')],
      charset: false,
      quietDeps: true,
      sourceMap: isDebugMode,
      sourceMapIncludeSources: isDebugMode
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

    // debugモード以外は常にminify
    if (!isDebugMode) {
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

    const outputRelativePath = relative(paths.src, filePath).replace(/\.scss$/, '.css')
    const outputPath = resolve(paths.dist, outputRelativePath)

    const postcssResult = await postcss(postcssPlugins).process(css, {
      from: filePath,
      to: outputPath,
      map: isDebugMode ? { inline: false, annotation: true } : false
    })

    css = postcssResult.css

    // 出力
    await ensureFileDir(outputPath)
    await writeFile(outputPath, css, 'utf8')

    // debugモード時はソースマップを出力
    if (isDebugMode && postcssResult.map) {
      const mapPath = `${outputPath}.map`
      await writeFile(mapPath, postcssResult.map.toString(), 'utf8')
    }
  } catch (error) {
    logger.error('sass', `Failed to compile ${basename(filePath)}: ${error.message}`)
    throw error
  }
}

export default sassTask
