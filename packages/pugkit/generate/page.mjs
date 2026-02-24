import { writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { ensureFileDir } from '../utils/file.mjs'

export async function generatePage(filePath, html, paths) {
  const relativePath = relative(paths.src, filePath)
  const outputPath = resolve(paths.dist, relativePath.replace(/\.pug$/, '.html'))

  await ensureFileDir(outputPath)
  await writeFile(outputPath, html, 'utf8')

  return outputPath
}
