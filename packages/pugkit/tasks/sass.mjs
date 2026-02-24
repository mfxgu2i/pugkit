import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, basename, extname } from 'node:path'
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
  const { paths, config, isProduction } = context

  // debugモードはdevモード時のみ有効
  const isDebugMode = !isProduction && config.debug

  // 1. ビルド対象ファイルの取得
  const scssFiles = await glob('**/[^_]*.scss', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*.scss']
  })

  if (scssFiles.length === 0) {
    logger.skip('sass', 'No files to build')
    return
  }

  logger.info('sass', `Building ${scssFiles.length} file(s)`)

  // 2. 並列コンパイル
  await Promise.all(scssFiles.map(file => compileSassFile(file, context, isDebugMode)))

  logger.success('sass', `Built ${scssFiles.length} file(s)`)
}

/**
 * 個別Sassファイルのコンパイル
 */
async function compileSassFile(filePath, context, isDebugMode) {
  const { paths, config, isProduction } = context

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
