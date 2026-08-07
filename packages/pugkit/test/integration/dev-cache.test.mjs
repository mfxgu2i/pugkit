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
