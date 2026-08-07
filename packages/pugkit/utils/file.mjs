import { mkdir, rm, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// dev キャッシュディレクトリが pugkit の管理下であることを示す目印
export const DEV_CACHE_MARKER = '.pugkit-dev-cache'

/**
 * ファイル操作ヘルパー
 */

/**
 * ディレクトリを作成（再帰的）
 */
export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true })
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
  await rm(dirPath, { recursive: true, force: true })
  await mkdir(dirPath, { recursive: true })
}

/**
 * dev キャッシュディレクトリを空の状態から作り直す。
 *
 * 中身を削除する前に「pugkit が作ったディレクトリか」を目印ファイルで確認する。
 * cacheDir に既存資産のあるパスを誤って指定してもユーザーのファイルは削除せず、
 * 起動を中止する。
 */
export async function resetDevCache(dirPath) {
  if (existsSync(dirPath)) {
    const entries = await readdir(dirPath)

    if (entries.length > 0 && !entries.includes(DEV_CACHE_MARKER)) {
      throw new Error(
        `dev の出力先 "${dirPath}" は pugkit が作成したディレクトリではありません。` +
          '中身を削除する必要があるため起動を中止しました。' +
          'cacheDir には空のディレクトリか存在しないパスを指定してください。'
      )
    }

    await rm(dirPath, { recursive: true, force: true })
  }

  await mkdir(dirPath, { recursive: true })
  await writeFile(resolve(dirPath, DEV_CACHE_MARKER), '')
}

