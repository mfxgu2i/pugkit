import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, extname } from 'node:path'
import sizeOf from 'image-size'

// 同じ画像は複数ページから参照されるので、読み取り結果をセッション中は使い回す。
// 保持するのは寸法だけで、画像のバイト列は残さない
// （読むのはヘッダだけなのに全体を抱えると、写真の多いサイトで際限なく増える）
const _imageSizeCache = new Map()

function readImageSizeCached(filePath) {
  const cached = _imageSizeCache.get(filePath)
  if (cached) return cached

  const { width, height, type } = sizeOf(readFileSync(filePath))
  const size = { width, height, type }
  _imageSizeCache.set(filePath, size)
  return size
}

export function clearImageSizeCache() {
  _imageSizeCache.clear()
}

/**
 * Pug から参照された画像パスを実ファイルへ解決する。
 * 「/」始まりは src からの絶対参照、それ以外はページからの相対参照。
 * src に無ければ public も見る（public に置いた画像も HTML から参照されるため）。
 */
function createImageResolver(filePath, paths) {
  const pageDir = dirname(filePath)

  return src => {
    const resolved = src.startsWith('/') ? resolve(paths.src, src.slice(1)) : resolve(pageDir, src)
    if (existsSync(resolved)) return resolved

    const inPublic = resolve(paths.public, relative(paths.src, resolved))
    return existsSync(inPublic) ? inPublic : null
  }
}

/**
 * Pug に渡す imageInfo ヘルパーを作る。
 *
 * 画像の実寸を読んで返し、あわせて retina（@2x）とアートディレクション用の
 * 派生画像を自動検出する。imageOptimization が avif/webp のときは src を
 * 変換後の拡張子に読み替える。
 */
export function createImageInfoHelper(filePath, paths, logger, config, { onAccess } = {}) {
  const optimization = config?.build?.imageOptimization
  const convertedExt = optimization === 'avif' || optimization === 'webp' ? `.${optimization}` : null
  const artDirectionSuffix = config?.build?.imageInfo?.artDirectionSuffix ?? '_sp'
  const findImageFile = createImageResolver(filePath, paths)

  return src => {
    const fallback = {
      src,
      width: undefined,
      height: undefined,
      format: undefined,
      isSvg: false,
      retina: null,
      variant: null
    }

    try {
      const foundPath = findImageFile(src)

      if (!foundPath) {
        logger?.warn('pug', `Image not found "${src}" in ${relative(paths.src, filePath)}`)
        return fallback
      }

      onAccess?.(foundPath)
      const { width, height, type: format } = readImageSizeCached(foundPath)

      const ext = extname(src)
      const isSvg = ext.toLowerCase() === '.svg'
      const base = src.slice(0, -ext.length)

      /** 同名にサフィックスを足した派生画像（@2x や _sp）を探す。無ければ null */
      const findSibling = suffix => {
        if (isSvg) return null

        const siblingSrc = `${base}${suffix}${ext}`
        const siblingPath = findImageFile(siblingSrc)
        if (!siblingPath) return null

        onAccess?.(siblingPath)
        const sibling = readImageSizeCached(siblingPath)

        return {
          src: convertedExt ? `${base}${suffix}${convertedExt}` : siblingSrc,
          width: sibling.width,
          height: sibling.height
        }
      }

      return {
        // SVG は変換対象外なので src をそのまま使う
        src: !isSvg && convertedExt ? `${base}${convertedExt}` : src,
        width,
        height,
        format,
        isSvg,
        retina: findSibling('@2x'),
        variant: findSibling(artDirectionSuffix)
      }
    } catch (error) {
      logger?.warn('pug', `Failed to read "${src}" in ${relative(paths.src, filePath)}: ${error.message}`)
      return fallback
    }
  }
}
