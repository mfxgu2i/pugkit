import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename, extname } from 'node:path'
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

      logger?.warn('pug', `Image not found: ${basename(resolvedPath)}`)
      return { width: undefined, height: undefined }
    } catch {
      logger?.warn('pug', `Failed to get image size: ${basename(src)}`)
      return { width: undefined, height: undefined }
    }
  }
}

export function createImageInfoHelper(filePath, paths, logger, config) {
  const useWebp = config?.build?.imageOptimization === 'webp'
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
      sp: null
    }

    try {
      const pageDir = dirname(filePath)
      const resolvedPath = resolveImagePath(src, pageDir)
      const foundPath = findImageFile(resolvedPath)

      if (!foundPath) {
        logger?.warn('pug', `Image not found: ${basename(resolvedPath)}`)
        return fallback
      }

      const buffer = readFileSync(foundPath)
      const { width, height, type: format } = sizeOf(buffer)

      const ext = extname(src)
      const isSvg = ext.toLowerCase() === '.svg'
      const base = src.slice(0, -ext.length)
      // webp モード時は src 自体を .webp パスに変換（SVG は除外）
      const resolvedSrc = useWebp && !isSvg ? `${base}.webp` : src

      // 2x retina 画像の自動検出
      let retina = null
      if (!isSvg) {
        const retinaSrc = `${base}@2x${ext}`
        const retinaResolvedPath = resolveImagePath(retinaSrc, pageDir)
        const retinaFoundPath = findImageFile(retinaResolvedPath)
        if (retinaFoundPath) {
          retina = { src: useWebp ? `${base}@2x.webp` : retinaSrc }
        }
      }

      // SP 画像の自動検出
      let sp = null
      if (!isSvg) {
        const spSrc = `${base}_sp${ext}`
        const spResolvedPath = resolveImagePath(spSrc, pageDir)
        const spFoundPath = findImageFile(spResolvedPath)
        if (spFoundPath) {
          const spBuffer = readFileSync(spFoundPath)
          const { width: spWidth, height: spHeight } = sizeOf(spBuffer)
          sp = {
            src: useWebp ? `${base}_sp.webp` : spSrc,
            width: spWidth,
            height: spHeight
          }
        }
      }

      return { src: resolvedSrc, width, height, format, isSvg, retina, sp }
    } catch {
      logger?.warn('pug', `Failed to get image info: ${basename(src)}`)
      return fallback
    }
  }
}
