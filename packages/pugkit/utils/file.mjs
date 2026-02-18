import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * ファイル操作ヘルパー
 */

/**
 * ディレクトリを作成（再帰的）
 */
export async function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }
}

/**
 * ファイル書き込み前にディレクトリを確保
 */
export async function ensureFileDir(filePath) {
  await ensureDir(dirname(filePath))
}

/**
 * ディレクトリをクリーンアップ
 */
export async function cleanDir(dirPath) {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true })
  }
  await mkdir(dirPath, { recursive: true })
}

/**
 * ファイル拡張子を変更
 */
export function changeExtension(filePath, newExt) {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) {
    return filePath + newExt
  }
  return filePath.substring(0, lastDot) + newExt
}
