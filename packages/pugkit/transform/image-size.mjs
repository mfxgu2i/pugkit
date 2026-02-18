import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
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
