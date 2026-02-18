import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, dirname, extname } from 'node:path'
import sharp from 'sharp'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

/**
 * 画像最適化タスク
 */
export async function imageTask(context, options = {}) {
  const { paths, config, isProduction, cache } = context

  const optimization = config.build.imageOptimization

  if (!optimization || optimization === false) {
    logger.skip('image', 'Image optimization disabled')
    return
  }

  // 特定のファイルが指定されている場合（watch時）
  if (options.files && Array.isArray(options.files)) {
    logger.info('image', `Processing ${options.files.length} image(s)`)
    await Promise.all(options.files.map(file => processImage(file, context, optimization, isProduction)))
    logger.success('image', `Processed ${options.files.length} image(s)`)
    return
  }

  // 対象画像を取得
  const images = await glob('**/*.{jpg,jpeg,png,gif}', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*/**']
  })

  if (images.length === 0) {
    logger.skip('image', 'No images found')
    return
  }

  logger.info('image', `Processing ${images.length} image(s)`)

  // 並列処理
  await Promise.all(images.map(file => processImage(file, context, optimization, isProduction)))

  logger.success('image', `Processed ${images.length} image(s)`)
}

/**
 * 画像を処理（最適化）
 */
async function processImage(filePath, context, optimization, isProduction) {
  const { paths, config } = context
  const ext = extname(filePath).toLowerCase()
  const relativePath = relative(paths.src, filePath)

  try {
    const image = sharp(filePath)
    const metadata = await image.metadata()

    let outputPath
    let outputImage

    if (optimization === 'webp') {
      // WebP変換
      outputPath = resolve(paths.dist, relativePath.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp'))
      outputImage = image.webp(config.build.imageOptions.webp)
    } else {
      // 元の形式で圧縮
      outputPath = resolve(paths.dist, relativePath)

      if (ext === '.jpg' || ext === '.jpeg') {
        outputImage = image.jpeg(config.build.imageOptions.jpeg)
      } else if (ext === '.png') {
        outputImage = image.png(config.build.imageOptions.png)
      } else {
        // GIFなどはそのままコピー
        const buffer = await readFile(filePath)
        await ensureFileDir(outputPath)
        await writeFile(outputPath, buffer)
        return
      }
    }

    // 保存
    await ensureFileDir(outputPath)
    await outputImage.toFile(outputPath)
  } catch (error) {
    logger.error('image', `Failed to process ${relativePath}: ${error.message}`)
  }
}

export default imageTask
