import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, extname } from 'node:path'
import sizeOf from 'image-size'

// ビルドセッション内で画像ファイルの内容をキャッシュし、同じファイルの重複読み込みを防ぐ
const _imageBufferCache = new Map()

function readImageCached(filePath) {
  if (_imageBufferCache.has(filePath)) return _imageBufferCache.get(filePath)
  const buf = readFileSync(filePath)
  _imageBufferCache.set(filePath, buf)
  return buf
}

export function clearImageSizeCache() {
  _imageBufferCache.clear()
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
      const { width, height, type: format } = sizeOf(readImageCached(foundPath))

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
        const sibling = sizeOf(readImageCached(siblingPath))

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
