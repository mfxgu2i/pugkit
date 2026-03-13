import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, extname } from 'node:path'
import sharp from 'sharp'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

// libvips の内部キャッシュを制限してメモリ消費を抑える
sharp.cache({ memory: 50, files: 20, items: 200 })
sharp.concurrency(1)

/**
 * 画像最適化タスク
 */
export async function imageTask(context, options = {}) {
  const { paths, config, isProduction } = context

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

  if (optimization === 'avif' || optimization === 'webp') {
    const outputMap = new Map()
    for (const file of images) {
      const rel = relative(paths.src, file)
      const outPath = rel.replace(/\.(jpg|jpeg|png|gif)$/i, `.${optimization}`)
      if (outputMap.has(outPath)) {
        logger.warn('image', `Output conflict: "${outputMap.get(outPath)}" and "${rel}" both map to "${outPath}"`)
      } else {
        outputMap.set(outPath, rel)
      }
    }
  }

  // 並列処理
  await Promise.all(images.map(file => processImage(file, context, optimization, isProduction)))

  logger.success('image', `Processed ${images.length} image(s)`)
}

/**
 * 画像を処理（最適化）
 */
async function processImage(filePath, context, optimization, isProduction, retries = 3, retryDelay = 200) {
  const { paths, config } = context
  const ext = extname(filePath).toLowerCase()
  const relativePath = relative(paths.src, filePath)
  const overrideKey = relativePath.replace(/\\/g, '/')
  const overrides = config.build.imageOverrides?.[overrideKey] ?? {}

  try {
    const image = sharp(filePath)

    let outputPath
    let outputImage

    if (optimization === 'avif') {
      // AVIF変換
      outputPath = resolve(paths.dist, relativePath.replace(/\.(jpg|jpeg|png|gif)$/i, '.avif'))
      outputImage = image.avif({ ...config.build.imageOptions.avif, ...overrides })
    } else if (optimization === 'webp') {
      // WebP変換
      outputPath = resolve(paths.dist, relativePath.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp'))
      outputImage = image.webp({ ...config.build.imageOptions.webp, ...overrides })
    } else {
      // 元の形式で圧縮
      outputPath = resolve(paths.dist, relativePath)

      if (ext === '.jpg' || ext === '.jpeg') {
        outputImage = image.jpeg({ ...config.build.imageOptions.jpeg, ...overrides })
      } else if (ext === '.png') {
        outputImage = image.png({ ...config.build.imageOptions.png, ...overrides })
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
    if (retries > 0 && error.message.includes('unsupported image format')) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return processImage(filePath, context, optimization, isProduction, retries - 1, retryDelay * 2)
    }
    logger.error('image', `Failed to process ${relativePath}: ${error.message}`)
  }
}

export default imageTask
