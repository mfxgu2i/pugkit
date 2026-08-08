import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
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

/** 目印に記録された持ち主。記録が無い（以前のバージョンが作った）場合は null */
async function readOwnerPid(dirPath) {
  try {
    const pid = Number.parseInt(await readFile(resolve(dirPath, DEV_CACHE_MARKER), 'utf8'), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** シグナル 0 は存在確認だけを行う。EPERM は「居るが触れない」なので生存 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * dev キャッシュディレクトリを空の状態から作り直す。
 *
 * 中身を削除するので、二段で確認する:
 *   1. pugkit が作ったディレクトリか（目印ファイルの有無）
 *      → cacheDir に既存資産のあるパスを誤って指定しても消さない
 *   2. 別の dev サーバーが使用中でないか（目印に記録された持ち主の生存）
 *      → ポートの空き確認では守れない。--port を変えれば2つ目が起動できてしまい、
 *        判定するものと壊すものが対応しないため、守る対象そのものに持ち主を持たせる
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

    const owner = await readOwnerPid(dirPath)
    if (owner !== null && owner !== process.pid && isProcessAlive(owner)) {
      throw new Error(
        `dev の出力先 "${dirPath}" は別の dev サーバー（PID ${owner}）が使用中です。` +
          '中身を削除する必要があるため起動を中止しました。' +
          'そちらを終了するか、cacheDir に別のパスを指定してください。'
      )
    }

    await rm(dirPath, { recursive: true, force: true })
  }

  await mkdir(dirPath, { recursive: true })
  await writeFile(resolve(dirPath, DEV_CACHE_MARKER), String(process.pid))
}

