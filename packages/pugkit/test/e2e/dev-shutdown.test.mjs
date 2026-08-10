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

/**
 * 子プロセスの終了を待つ上限。
 *
 * 待ち時間は「終わるまで」ではなく上限なので、長く取っても正常時は速い。
 * 短くすると、他のテストと同時に走ったときの揺れ（実測 8〜20 秒）を拾って偽の失敗になる。
 */
const EXIT_TIMEOUT_MS = 60000

/**
 * vitest 側の上限。**内部の上限より必ず長くする。**
 * 逆にすると vitest が先に打ち切り、「終わらなかった」のか「遅かっただけ」なのか
 * 区別できないまま失敗する（vitest.config.mjs の既定は 20 秒）
 */
const TEST_TIMEOUT_MS = EXIT_TIMEOUT_MS + 30000

/**
 * process.exit を呼ばずに終わるか。終わらなければ 'timeout'。
 */
function runUntilExit(source, timeoutMs = EXIT_TIMEOUT_MS) {
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
  it('close() しなければ終わらない（このテスト自身の妥当性の確認）', async () => {
    const project = await createTempProject(minimalProjectFiles())

    const result = await runUntilExit(
      `
      import { createBuilder } from '${ENTRY}'
      const builder = await createBuilder(${JSON.stringify(project.root)}, 'development')
      builder.context.config.server.port = 0
      await builder.watch()
    `,
      1500
    )

    expect(result).toBe('timeout')
  })

  // 2周するので「1周目の close() が効いていること」も同時に確かめられる
  it(
    'close() すればプロセスが終わり、同じプロセスで再び起動もできる',
    async () => {
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
    },
    TEST_TIMEOUT_MS
  )
})
