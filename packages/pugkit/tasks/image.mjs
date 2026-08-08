import { glob } from 'glob'
import { readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, extname } from 'node:path'
import sharp from 'sharp'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'
import { densityOutputs, hasScaledVariant, scaleDown, sourceDensityOf } from '../utils/image-density.mjs'

// libvips の内部キャッシュを制限してメモリ消費を抑える
sharp.cache({ memory: 50, files: 20, items: 200 })
sharp.concurrency(1)

export const IMAGE_GLOB = '**/*.{jpg,jpeg,png,gif}'
export const IMAGE_IGNORE = ['**/_*/**']

// src に置かれても、どのタスクの担当にもならない画像形式。
// imageInfo() は寸法を読んで参照を書くので、放置すると無警告のリンク切れになる
const UNHANDLED_GLOB = '**/*.{webp,avif}'

/**
 * 画像の出力先。生成側と watcher の削除側で規則がずれると、
 * 消したはずの画像が配信され続けるので、ここ一箇所に置く。
 *
 * 1 ソースが複数の密度を生成するため配列を返す。筆頭は必ず原寸。
 */
export function imageOutputPaths(relativePath, config, paths) {
  return densityOutputs(relativePath, config.build.imageOptimization, sourceDensityOf(config)).map(out => ({
    ...out,
    relative: out.name,
    absolute: resolve(paths.output, out.name)
  }))
}

/**
 * 画像最適化タスク
 */
export async function imageTask(context, options = {}) {
  const { paths } = context

  const images = await glob(IMAGE_GLOB, {
    cwd: paths.src,
    absolute: true,
    ignore: IMAGE_IGNORE
  })

  // 変更されたファイルだけ（dev の監視時）
  if (options.changed) {
    await processImage(options.changed, context)
    logger.success('image', `Processed ${relative(paths.src, options.changed)}`)
    return
  }

  if (images.length === 0) {
    logger.skip('image', 'No images found')
    return
  }

  await warnUnhandledImages(context)

  logger.info('image', `Processing ${images.length} image(s)`)

  // 並列処理
  await Promise.all(images.map(file => processImage(file, context)))

  logger.success('image', `Processed ${images.length} image(s)`)
}

/**
 * 変換対象外の画像形式が src にあれば知らせる。
 *
 * これらは image タスクの対象でも svg タスクの対象でもなく、copy は public しか見ないため
 * 出力に出ない。それでも imageInfo() は寸法を読んで参照を書くので、
 * 黙っていると「HTML に書かれているのにファイルが無い」状態になる
 */
async function warnUnhandledImages(context) {
  const { paths } = context
  const unhandled = await glob(UNHANDLED_GLOB, { cwd: paths.src, ignore: IMAGE_IGNORE })

  if (unhandled.length === 0) return

  logger.warn('image', `変換対象外のため出力されません（public/ に置いてください）: ${unhandled.sort().join(', ')}`)
}

/**
 * 拡張子と最適化設定から、sharp のエンコード関数を選ぶ。
 * sharp を通せない組み合わせ（compress モードの GIF）は null
 */
function resolveEncoder(ext, config) {
  const { imageOptimization, imageOptions } = config.build

  if (imageOptimization === 'avif') return (pipeline, opts) => pipeline.avif({ ...imageOptions.avif, ...opts })
  if (imageOptimization === 'webp') return (pipeline, opts) => pipeline.webp({ ...imageOptions.webp, ...opts })
  if (ext === '.jpg' || ext === '.jpeg') return (pipeline, opts) => pipeline.jpeg({ ...imageOptions.jpeg, ...opts })
  if (ext === '.png') return (pipeline, opts) => pipeline.png({ ...imageOptions.png, ...opts })

  return null
}

/**
 * 画像を処理（最適化）
 */
async function processImage(filePath, context, retries = 3, retryDelay = 200) {
  const { paths, config } = context
  const ext = extname(filePath).toLowerCase()
  const relativePath = relative(paths.src, filePath)
  const overrideKey = relativePath.replace(/\\/g, '/')
  const overrides = config.build.imageOverrides?.[overrideKey] ?? {}
  const sourceDensity = sourceDensityOf(config)

  try {
    const outputs = imageOutputPaths(relativePath, config, paths)
    const encoder = resolveEncoder(ext, config)

    // sharp を通せない形式は原寸をそのままコピーする（compress モードの GIF）
    if (!encoder) {
      const [original] = outputs
      await ensureFileDir(original.absolute)
      await writeFile(original.absolute, await readFile(filePath))
      return
    }

    // 縮小版を作るかは原寸に依る。1x1 のような画像で同じ寸法を 2 枚配らない
    const size = outputs.length > 1 ? await sharp(filePath).metadata() : null
    const scalable = size ? hasScaledVariant(size.width, size.height, sourceDensity) : false

    await Promise.all(
      outputs.map(async out => {
        const isOriginal = out.density >= sourceDensity
        if (!isOriginal && !scalable) return

        // 別インスタンスで並列に流す。clone() に有意な差は無く、メモリは僅かに増える
        const pipeline = sharp(filePath)
        if (!isOriginal) {
          const factor = sourceDensity / out.density
          pipeline.resize(scaleDown(size.width, factor), scaleDown(size.height, factor))
        }

        await ensureFileDir(out.absolute)
        await encoder(pipeline, overrides).toFile(out.absolute)
      })
    )
  } catch (error) {
    if (retries > 0 && error.message.includes('unsupported image format')) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return processImage(filePath, context, retries - 1, retryDelay * 2)
    }
    logger.error('image', `Failed to process ${relativePath}: ${error.message}`)
  }
}

export default imageTask
