import { writeFile, copyFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { ensureFileDir } from '../utils/file.mjs'

export async function generateAsset(outputPath, data) {
  await ensureFileDir(outputPath)

  if (typeof data === 'string' || Buffer.isBuffer(data)) {
    await writeFile(outputPath, data)
  } else {
    throw new TypeError(`generateAsset: data must be a string or Buffer, got ${typeof data}`)
  }

  return outputPath
}

export async function copyAsset(srcPath, destPath) {
  await ensureFileDir(destPath)
  await copyFile(srcPath, destPath)
  return destPath
}
