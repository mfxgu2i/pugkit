import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { optimize } from 'svgo'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

/**
 * SVG最適化タスク
 */
export async function svgTask(context, options = {}) {
  const { paths } = context

  // 特定のファイルが指定されている場合（watch時）
  if (options.files && Array.isArray(options.files)) {
    logger.info('svg', `Optimizing ${options.files.length} SVG file(s)`)
    await Promise.all(options.files.map(file => optimizeSvg(file, context)))
    logger.success('svg', `Optimized ${options.files.length} SVG file(s)`)
    return
  }

  // 対象SVGを取得
  const svgs = await glob('**/*.svg', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*/**', '**/icons/**'] // iconsはスプライト用なので除外
  })

  if (svgs.length === 0) {
    logger.skip('svg', 'No SVG files found')
    return
  }

  logger.info('svg', `Optimizing ${svgs.length} SVG file(s)`)

  // 並列処理
  await Promise.all(svgs.map(file => optimizeSvg(file, context)))

  logger.success('svg', `Optimized ${svgs.length} SVG file(s)`)
}

/**
 * SVGを最適化
 */
async function optimizeSvg(filePath, context) {
  const { paths } = context
  const relativePath = relative(paths.src, filePath)

  try {
    const content = await readFile(filePath, 'utf8')

    // SVGOで最適化
    const result = optimize(content, {
      path: filePath,
      plugins: [
        'preset-default',
        {
          name: 'removeViewBox',
          active: false
        }
      ]
    })

    // 出力
    const outputPath = resolve(paths.dist, relativePath)
    await ensureFileDir(outputPath)
    await writeFile(outputPath, result.data, 'utf8')
  } catch (error) {
    logger.error('svg', `Failed to optimize ${relativePath}: ${error.message}`)
  }
}

export default svgTask
