import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { optimize } from 'svgo'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

export const SVG_GLOB = '**/*.svg'
// icons はスプライト用なので個別出力の対象外
export const SVG_IGNORE = ['**/_*/**', '**/icons/**']

/**
 * SVG の出力先。生成側と watcher の削除側で規則がずれると、
 * 消したはずのファイルが配信され続けるので、ここ一箇所に置く
 */
export function svgOutputPath(relativePath, paths) {
  return paths ? resolve(paths.output, relativePath) : relativePath
}

/**
 * SVG最適化タスク
 */
export async function svgTask(context, options = {}) {
  const { paths } = context

  // 特定のファイルが指定されている場合（watch時）
  // 変更されたファイルだけ（dev の監視時）
  if (options.changed) {
    await optimizeSvg(options.changed, context)
    logger.success('svg', `Optimized ${relative(paths.src, options.changed)}`)
    return
  }

  // 対象SVGを取得
  const svgs = await glob(SVG_GLOB, {
    cwd: paths.src,
    absolute: true,
    ignore: SVG_IGNORE
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
      plugins: ['preset-default']
    })

    // 出力
    const outputPath = svgOutputPath(relativePath, paths)
    await ensureFileDir(outputPath)
    await writeFile(outputPath, result.data, 'utf8')
  } catch (error) {
    logger.error('svg', `Failed to optimize ${relativePath}: ${error.message}`)
  }
}

export default svgTask
