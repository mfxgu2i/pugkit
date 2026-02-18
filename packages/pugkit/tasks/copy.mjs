import { glob } from 'glob'
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { relative, resolve, basename } from 'node:path'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

/**
 * ファイルコピータスク
 */
export async function copyTask(context, options = {}) {
  const { paths } = context

  const files = await glob('**/*', {
    cwd: paths.public,
    absolute: true,
    nodir: true,
    dot: true
  })

  if (files.length === 0) {
    logger.skip('copy', 'No files to copy')
    return
  }

  logger.info('copy', `Copying ${files.length} file(s)`)

  await Promise.all(
    files.map(async file => {
      const relativePath = relative(paths.public, file)
      const outputPath = resolve(paths.dist, relativePath)

      await ensureFileDir(outputPath)
      await copyFile(file, outputPath)
    })
  )

  logger.success('copy', `Copied ${files.length} file(s)`)
}

export default copyTask
