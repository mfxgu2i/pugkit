import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { createTempProject } from '../helpers/project.mjs'

/**
 * CLI の終了コードは、これを通らないと確かめられない。
 * 公開 API の check() は結果を返すだけで、プロセスを終わらせないため。
 */

const run = promisify(execFile)
const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '../../cli/index.mjs')

/** @returns {{ code: number, stdout: string, stderr: string }} */
async function pugkit(cwd, args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { cwd })
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
}

const project = files =>
  createTempProject({
    'package.json': '{"name":"fixture","type":"module"}',
    'pugkit.config.mjs': 'export default {}',
    ...files
  })

describe('pugkit check の終了コード', () => {
  it('違反があれば 1、無ければ 0', async () => {
    const broken = await project({ 'dist/index.html': '<a href="/nowhere/">x</a>' })
    const clean = await project({ 'dist/index.html': '<a href="/about/">x</a>', 'dist/about/index.html': '<p>a</p>' })

    const failed = await pugkit(broken.root, ['check', 'references'])
    const passed = await pugkit(clean.root, ['check', 'references'])

    expect(failed.code).toBe(1)
    expect(failed.stdout).toContain('/nowhere/')

    expect(passed.code).toBe(0)
    expect(passed.stdout).toContain('no problems found')
  })

  it('知らない検査項目は中止する', async () => {
    const p = await project({ 'dist/index.html': '<p>x</p>' })

    const { code, stderr } = await pugkit(p.root, ['check', 'referencs'])

    expect(code).toBe(1)
    expect(stderr).toContain('referencs')
    expect(stderr).toContain('references')
  })

  it('出力先が無ければ中止する', async () => {
    const p = await project({})

    const { code, stderr } = await pugkit(p.root, ['check'])

    expect(code).toBe(1)
    expect(stderr).toContain('pugkit build')
  })

  it('知らないコマンドは中止する。dev サーバーを起動しない', async () => {
    // 位置引数を廃止したので、綴り違いは既定コマンド（dev）に落ちる
    const p = await project({ 'dist/index.html': '<p>x</p>' })

    const { code, stderr } = await pugkit(p.root, ['chekc'])

    expect(code).toBe(1)
    expect(stderr).toContain('chekc')
  })
})
