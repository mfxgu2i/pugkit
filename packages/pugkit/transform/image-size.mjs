import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, basename, extname } from 'node:path'
import sizeOf from 'image-size'

export function createImageSizeHelper(filePath, paths, logger) {
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
        const buffer = readFileSync(foundPath)
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

export function createImageInfoHelper(filePath, paths, logger, config) {
  const useWebp = config?.build?.imageOptimization === 'webp'
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

      const buffer = readFileSync(foundPath)
      const { width, height, type: format } = sizeOf(buffer)

      const ext = extname(src)
      const isSvg = ext.toLowerCase() === '.svg'
      const base = src.slice(0, -ext.length)
      // webp モード時は src 自体を .webp パスに変換（SVG は除外）
      const resolvedSrc = useWebp && !isSvg ? `${base}.webp` : src

      // @2x retina 画像の自動検出
      let retina = null
      if (!isSvg) {
        const retinaSrc = `${base}@2x${ext}`
        const retinaResolvedPath = resolveImagePath(retinaSrc, pageDir)
        const retinaFoundPath = findImageFile(retinaResolvedPath)
        if (retinaFoundPath) {
          const retinaBuffer = readFileSync(retinaFoundPath)
          const { width: rWidth, height: rHeight } = sizeOf(retinaBuffer)
          retina = {
            src: useWebp ? `${base}@2x.webp` : retinaSrc,
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
          const variantBuffer = readFileSync(variantFoundPath)
          const { width: vWidth, height: vHeight } = sizeOf(variantBuffer)
          variant = {
            src: useWebp ? `${base}${artDirectionSuffix}.webp` : variantSrc,
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
