import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, basename, extname } from 'node:path'
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

export function createImageSizeHelper(filePath, paths, logger, { onAccess } = {}) {
  return src => {
    const resolveImagePath = (imageSrc, baseDir) => {
      if (imageSrc.startsWith('/')) {
        return resolve(paths.src, imageSrc.slice(1))
      }
      return resolve(baseDir, imageSrc)
    }

    const findImageFile = resolvedPath => {
      if (existsSync(resolvedPath)) return resolvedPath
      const publicPath = resolvedPath.replace(paths.src, paths.public)
      if (existsSync(publicPath)) return publicPath
      return null
    }

    try {
      const pageDir = dirname(filePath)
      const resolvedPath = resolveImagePath(src, pageDir)
      const foundPath = findImageFile(resolvedPath)

      if (foundPath) {
        onAccess?.(foundPath)
        const buffer = readImageCached(foundPath)
        return sizeOf(buffer)
      }

      logger?.warn('pug', `Image not found "${src}" in ${relative(paths.src, filePath)}`)
      return { width: undefined, height: undefined }
    } catch {
      logger?.warn('pug', `Failed to read "${src}" in ${relative(paths.src, filePath)}`)
      return { width: undefined, height: undefined }
    }
  }
}

export function createImageInfoHelper(filePath, paths, logger, config, { onAccess } = {}) {
  const optimization = config?.build?.imageOptimization
  const newExt = optimization === 'avif' || optimization === 'webp' ? `.${optimization}` : null
  const artDirectionSuffix = config?.build?.imageInfo?.artDirectionSuffix ?? '_sp'

  return src => {
    const resolveImagePath = (imageSrc, baseDir) => {
      if (imageSrc.startsWith('/')) {
        return resolve(paths.src, imageSrc.slice(1))
      }
      return resolve(baseDir, imageSrc)
    }

    const findImageFile = resolvedPath => {
      if (existsSync(resolvedPath)) return resolvedPath
      return null
    }

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
      const pageDir = dirname(filePath)
      const resolvedPath = resolveImagePath(src, pageDir)
      const foundPath = findImageFile(resolvedPath)

      if (!foundPath) {
        logger?.warn('pug', `Image not found "${src}" in ${relative(paths.src, filePath)}`)
        return fallback
      }

      const buffer = readImageCached(foundPath)
      onAccess?.(foundPath)
      const { width, height, type: format } = sizeOf(buffer)

      const ext = extname(src)
      const isSvg = ext.toLowerCase() === '.svg'
      const base = src.slice(0, -ext.length)
      // avif/webp モード時は src 自体を変換後のパスに変換（SVG は除外）
      const resolvedSrc = !isSvg && newExt ? `${base}${newExt}` : src

      // @2x retina 画像の自動検出
      let retina = null
      if (!isSvg) {
        const retinaSrc = `${base}@2x${ext}`
        const retinaResolvedPath = resolveImagePath(retinaSrc, pageDir)
        const retinaFoundPath = findImageFile(retinaResolvedPath)
        if (retinaFoundPath) {
          const retinaBuffer = readImageCached(retinaFoundPath)
          onAccess?.(retinaFoundPath)
          const { width: rWidth, height: rHeight } = sizeOf(retinaBuffer)
          retina = {
            src: newExt ? `${base}@2x${newExt}` : retinaSrc,
            width: rWidth,
            height: rHeight
          }
        }
      }

      // アートディレクション画像の自動検出
      let variant = null
      if (!isSvg) {
        const variantSrc = `${base}${artDirectionSuffix}${ext}`
        const variantResolvedPath = resolveImagePath(variantSrc, pageDir)
        const variantFoundPath = findImageFile(variantResolvedPath)
        if (variantFoundPath) {
          const variantBuffer = readImageCached(variantFoundPath)
          onAccess?.(variantFoundPath)
          const { width: vWidth, height: vHeight } = sizeOf(variantBuffer)
          variant = {
            src: newExt ? `${base}${artDirectionSuffix}${newExt}` : variantSrc,
            width: vWidth,
            height: vHeight
          }
        }
      }

      return { src: resolvedSrc, width, height, format, isSvg, retina, variant }
    } catch {
      logger?.warn('pug', `Failed to read "${src}" in ${relative(paths.src, filePath)}`)
      return fallback
    }
  }
}
