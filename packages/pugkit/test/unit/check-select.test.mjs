import { describe, it, expect } from 'vitest'
import { CHECK_IDS, selectChecks } from '../../core/check/index.mjs'

const ids = items => selectChecks(items).map(check => check.id)

describe('selectChecks', () => {
  it('指定が無ければ全項目', () => {
    // CHECK_IDS と突き合わせると、項目を消しても同時に消えて気づけない
    expect(ids()).toEqual(['references', 'markup'])
    expect(ids([])).toEqual(['references', 'markup'])
  })

  it('項目が増えたら CHECK_IDS も一緒に増える', () => {
    // CLI のヘルプとエラー文言はこの一覧から作る
    expect(CHECK_IDS).toEqual(['references', 'markup'])
  })

  it('指定された項目だけを選ぶ', () => {
    expect(ids(['references'])).toEqual(['references'])
    expect(ids(['markup'])).toEqual(['markup'])
  })

  it('知らない id は中止して一覧を出す', () => {
    // 黙って無視すると、綴りを間違えた実行が「違反なし」と同じ表示になる
    expect(() => selectChecks(['referencs'])).toThrow(/referencs/)
    expect(() => selectChecks(['referencs'])).toThrow(/references/)
  })
})
