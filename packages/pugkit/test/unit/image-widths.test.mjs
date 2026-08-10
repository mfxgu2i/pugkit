import { describe, expect, it } from 'vitest'
import { ImageWidthRequests } from '../../core/image-widths.mjs'

/**
 * 幅は設定ではなく呼び出し側が決めるので、生成側は要求を集めないと何を作るか分からない。
 * ここがページをまたいで漏れると、srcset が指す先が出力に無いことになる。
 */

describe('ImageWidthRequests', () => {
  it('要求が無ければ空', () => {
    expect(new ImageWidthRequests().get('/a.jpg')).toEqual([])
  })

  it('記録した幅を昇順で返す（生成の順序を実行ごとに変えない）', () => {
    const store = new ImageWidthRequests()
    store.record('/a.jpg', [800, 400])

    expect(store.get('/a.jpg')).toEqual([400, 800])
  })

  /** 同じ画像を複数のページが違う幅で参照する。ファイルは要求された全部が要る */
  it('複数回の記録は和集合になる', () => {
    const store = new ImageWidthRequests()
    store.record('/a.jpg', [400, 800])
    store.record('/a.jpg', [800, 1200])

    expect(store.get('/a.jpg')).toEqual([400, 800, 1200])
  })

  it('画像ごとに分かれている', () => {
    const store = new ImageWidthRequests()
    store.record('/a.jpg', [400])
    store.record('/b.jpg', [800])

    expect(store.get('/a.jpg')).toEqual([400])
    expect(store.get('/b.jpg')).toEqual([800])
  })

  it('空の要求では鍵を作らない', () => {
    const store = new ImageWidthRequests()
    store.record('/a.jpg', [])

    expect(store.byImage.size).toBe(0)
  })

  /** clean() が呼ぶ。捨て損ねると、設定から消した幅が同じプロセスの次のビルドで出続ける */
  it('clear で全部捨てる', () => {
    const store = new ImageWidthRequests()
    store.record('/a.jpg', [400])
    store.clear()

    expect(store.get('/a.jpg')).toEqual([])
  })
})
