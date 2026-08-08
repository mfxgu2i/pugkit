import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resetDevCache, DEV_CACHE_MARKER } from '../../utils/file.mjs'

let root

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pugkit-devcache-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('resetDevCache', () => {
  it('should create the directory with a marker when it does not exist', async () => {
    const dir = resolve(root, 'cache')
    await resetDevCache(dir)
    expect(existsSync(resolve(dir, DEV_CACHE_MARKER))).toBe(true)
  })

  it('should accept an existing empty directory', async () => {
    const dir = resolve(root, 'cache')
    await mkdir(dir, { recursive: true })
    await resetDevCache(dir)
    expect(existsSync(resolve(dir, DEV_CACHE_MARKER))).toBe(true)
  })

  it('should wipe its own cache on a second run', async () => {
    const dir = resolve(root, 'cache')
    await resetDevCache(dir)
    await writeFile(resolve(dir, 'stale.css'), 'body{}')

    await resetDevCache(dir)

    expect(await readdir(dir)).toEqual([DEV_CACHE_MARKER])
  })

  it('should refuse to delete a directory it did not create', async () => {
    const dir = resolve(root, 'htdocs')
    await mkdir(dir, { recursive: true })
    await writeFile(resolve(dir, '.htaccess'), 'deny from all')
    await writeFile(resolve(dir, 'api.php'), '<?php')

    await expect(resetDevCache(dir)).rejects.toThrow()

    // ユーザーのファイルは残っている
    expect(existsSync(resolve(dir, '.htaccess'))).toBe(true)
    expect(existsSync(resolve(dir, 'api.php'))).toBe(true)
  })

  it('should refuse even when only a hidden file is present', async () => {
    const dir = resolve(root, 'somewhere')
    await mkdir(dir, { recursive: true })
    await writeFile(resolve(dir, '.env'), 'SECRET=1')

    await expect(resetDevCache(dir)).rejects.toThrow()
    expect(existsSync(resolve(dir, '.env'))).toBe(true)
  })
})

describe('使用中の dev キャッシュ', () => {
  /**
   * dev の起動は cacheDir を丸ごと作り直す。同じ cacheDir を使う dev サーバーが
   * 動いていると、その配信物を消してしまう。
   *
   * ポートの空き確認では守れない（--port を変えれば2つ目が起動できてしまい、
   * 判定しているものと壊すものが対応していない）ため、目印に持ち主を記録する。
   */
  const markerOf = dir => resolve(dir, DEV_CACHE_MARKER)

  /** 確実に存在しない PID を作る（起動して終了を待つ） */
  async function deadPid() {
    const { spawn } = await import('node:child_process')
    const child = spawn(process.execPath, ['-e', ''])
    await new Promise(resolve => child.once('exit', resolve))
    return child.pid
  }

  it('持ち主を目印に記録する', async () => {
    const dir = resolve(root, 'cache')

    await resetDevCache(dir)

    const { readFile } = await import('node:fs/promises')
    expect(await readFile(markerOf(dir), 'utf8')).toBe(String(process.pid))
  })

  it('生きている別プロセスが使っていたら中止する', async () => {
    const dir = resolve(root, 'cache')
    await resetDevCache(dir)
    await writeFile(markerOf(dir), String(process.ppid)) // 親プロセスは生きている
    await writeFile(resolve(dir, 'served.css'), 'body{}')

    await expect(resetDevCache(dir)).rejects.toThrow(/使用中|cacheDir/)
    // 相手の配信物を消していない
    expect(existsSync(resolve(dir, 'served.css'))).toBe(true)
  })

  it('持ち主が終了していれば引き継ぐ', async () => {
    const dir = resolve(root, 'cache')
    await resetDevCache(dir)
    await writeFile(markerOf(dir), String(await deadPid()))
    await writeFile(resolve(dir, 'stale.css'), 'body{}')

    await resetDevCache(dir)

    expect(existsSync(resolve(dir, 'stale.css'))).toBe(false)
  })

  it('自分が持ち主なら作り直せる（同一プロセスでの再起動）', async () => {
    const dir = resolve(root, 'cache')
    await resetDevCache(dir)
    await writeFile(resolve(dir, 'stale.css'), 'body{}')

    await resetDevCache(dir)

    expect(existsSync(resolve(dir, 'stale.css'))).toBe(false)
  })

  it('持ち主が記録されていない目印でも作り直せる（以前のバージョンが作ったもの）', async () => {
    const dir = resolve(root, 'cache')
    await mkdir(dir, { recursive: true })
    await writeFile(markerOf(dir), '')
    await writeFile(resolve(dir, 'stale.css'), 'body{}')

    await resetDevCache(dir)

    expect(existsSync(resolve(dir, 'stale.css'))).toBe(false)
  })
})
