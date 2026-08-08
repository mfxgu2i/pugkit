import { describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { createTempProject, minimalProjectFiles } from '../helpers/project.mjs'

/**
 * 公開 API で dev を止めたら、プロセスも終われること。
 *
 * dev は Sass と esbuild の常駐プロセスを抱える。これを破棄する口が無いと、
 * Ctrl+C（SIGINT でプロセスごと落ちる）以外の止め方ができない。
 * テストや、pugkit を組み込んで使う場合に効く。
 *
 * 「終わる」はハンドルの数え上げでは確かめにくい（テストランナー自身の
 * 子プロセスと混ざる）ため、子プロセスを起こして自然終了するかを見る。
 */
const ENTRY = new URL('../../index.mjs', import.meta.url).href

/** process.exit を呼ばずに終わるか。終わらなければ 'timeout' */
function runUntilExit(source, timeoutMs = 20000) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: 'ignore' })

  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve('timeout')
    }, timeoutMs)

    child.once('exit', code => {
      clearTimeout(timer)
      resolve(code)
    })
  })
}

describe('dev の停止', () => {
  it('close() を呼べばプロセスが自然終了する', async () => {
    const project = await createTempProject(minimalProjectFiles())

    const result = await runUntilExit(`
      import { createBuilder } from '${ENTRY}'
      const builder = await createBuilder(${JSON.stringify(project.root)}, 'development')
      builder.context.config.server.port = 0
      await builder.watch()
      await builder.close()
    `)

    expect(result).toBe(0)
  })

  it('close() しなければ終わらない（このテスト自身の妥当性の確認）', async () => {
    const project = await createTempProject(minimalProjectFiles())

    const result = await runUntilExit(
      `
      import { createBuilder } from '${ENTRY}'
      const builder = await createBuilder(${JSON.stringify(project.root)}, 'development')
      builder.context.config.server.port = 0
      await builder.watch()
    `,
      4000
    )

    expect(result).toBe('timeout')
  })

  it('停止したあとでも同じプロセスで再び起動できる', async () => {
    const project = await createTempProject(minimalProjectFiles())

    const result = await runUntilExit(`
      import { createBuilder } from '${ENTRY}'
      for (const _ of [1, 2]) {
        const builder = await createBuilder(${JSON.stringify(project.root)}, 'development')
        builder.context.config.server.port = 0
        await builder.watch()
        await builder.close()
      }
    `)

    expect(result).toBe(0)
  })
})
