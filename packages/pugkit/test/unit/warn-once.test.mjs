import { describe, expect, it, vi, afterEach } from 'vitest'
import { BuildContext } from '../../core/context.mjs'

/**
 * ページごとに判定する警告は、共通レイアウト由来だとページ数だけ並ぶ。
 * 数が多いと他のログを押し流して、かえって読まれなくなる。
 */
const createContext = () => new BuildContext({ root: '/project', outDir: 'dist' }, 'production')

/** logger は console.log に出すので、そちらを横取りする */
const captureLogs = () => vi.spyOn(console, 'log').mockImplementation(() => {})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BuildContext.warnOnce', () => {
  it('同じ理由は 1 回だけ出す', () => {
    const logs = captureLogs()
    const context = createContext()

    context.warnOnce('config', 'missing-site-url', '1 回目')
    context.warnOnce('config', 'missing-site-url', '2 回目')

    expect(logs).toHaveBeenCalledTimes(1)
    expect(logs.mock.calls[0].join(' ')).toContain('1 回目')
  })

  it('理由が違えばそれぞれ出す', () => {
    const logs = captureLogs()
    const context = createContext()

    context.warnOnce('config', 'a', 'A')
    context.warnOnce('config', 'b', 'B')

    expect(logs).toHaveBeenCalledTimes(2)
  })

  /**
   * 抑制はセッション単位。dev を起動したままにしても、build をやり直せば
   * 同じ警告がまた出る。前回の実行で見たかどうかを覚えていると、
   * 設定を直したつもりで直っていないことに気づけなくなる
   */
  it('コンテキストが変われば改めて出す', () => {
    const logs = captureLogs()

    createContext().warnOnce('config', 'missing-site-url', 'x')
    createContext().warnOnce('config', 'missing-site-url', 'x')

    expect(logs).toHaveBeenCalledTimes(2)
  })
})
