import { describe, expect, it } from 'vitest'
import { PassThrough, Readable } from 'node:stream'
import { guardStaticServe } from '../../core/dev/response.mjs'

/**
 * 静的配信は「存在を確認してから読み出す」ため、その間にファイルが消えると失敗する。
 * dev では watcher の削除・キャッシュ作り直しと配信が日常的に競合するので、
 * ここを守らないと dev サーバーがプロセスごと落ちる。
 *
 * 失敗の出方は2通りあり、受け止め方が違う:
 *   - 存在確認（statSync）の失敗 → 同期 throw。リクエストハンドラの外まで飛ぶ
 *   - 読み出し（createReadStream）の失敗 → 'error' イベント。listener が無いと落ちる
 */
function createResponse({ headersSent = false } = {}) {
  const res = new PassThrough()
  res.headersSent = headersSent
  res.wasDestroyed = false
  const destroy = res.destroy.bind(res)
  res.destroy = () => {
    res.wasDestroyed = true
    destroy()
  }
  return res
}

/** エラーを出す読み取りストリーム（消えたファイルの読み出しに相当） */
function createFailingSource(code = 'ENOENT') {
  const source = new Readable({ read() {} })
  queueMicrotask(() => source.destroy(Object.assign(new Error(code), { code })))
  return source
}

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('存在確認の失敗（同期 throw）', () => {
  it('呼び出し元に投げ返さない', () => {
    const serve = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    }
    const guarded = guardStaticServe(serve)

    expect(() => guarded({}, createResponse(), () => {})).not.toThrow()
  })

  it('まだ応答していなければ次の候補に回す（消えたファイルは 404 相当）', () => {
    let fellThrough = false
    const guarded = guardStaticServe(() => {
      throw new Error('boom')
    })

    guarded({}, createResponse(), () => {
      fellThrough = true
    })

    expect(fellThrough).toBe(true)
  })

  it('応答を始めた後なら接続を切る（続きを送れないため）', () => {
    const res = createResponse({ headersSent: true })
    const guarded = guardStaticServe(() => {
      throw new Error('boom')
    })

    guarded({}, res, () => {})

    expect(res.wasDestroyed).toBe(true)
  })

  it('失敗を報告する', () => {
    const reported = []
    const guarded = guardStaticServe(
      () => {
        throw Object.assign(new Error('gone'), { code: 'ENOENT' })
      },
      error => reported.push(error.code)
    )

    guarded({}, createResponse(), () => {})

    expect(reported).toEqual(['ENOENT'])
  })
})

describe('読み出しの失敗（ストリームの error）', () => {
  it('プロセスを落とさずに接続を切る', async () => {
    const res = createResponse({ headersSent: true })
    const guarded = guardStaticServe((req, response) => {
      createFailingSource().pipe(response)
    })

    guarded({}, res, () => {})
    await nextTick()

    expect(res.wasDestroyed).toBe(true)
  })

  it('失敗を報告する', async () => {
    const reported = []
    const guarded = guardStaticServe(
      (req, response) => createFailingSource('EACCES').pipe(response),
      error => reported.push(error.code)
    )

    guarded({}, createResponse({ headersSent: true }), () => {})
    await nextTick()

    expect(reported).toEqual(['EACCES'])
  })

  it('正常に配信できたときは何もしない', async () => {
    const reported = []
    const res = createResponse()
    const guarded = guardStaticServe(
      (req, response) => Readable.from(['body{}']).pipe(response),
      error => reported.push(error)
    )

    guarded({}, res, () => {})
    await nextTick()

    expect(reported).toEqual([])
    expect(res.wasDestroyed).toBe(false)
  })
})
