import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MINIMUM_NODE_MAJOR, unsupportedNodeMessage } from '../../utils/node-version.mjs'

describe('unsupportedNodeMessage', () => {
  it.each(['22.0.0', 'v22.20.0', '24.1.0', '99.0.0'])('%s は動かせる', version => {
    expect(unsupportedNodeMessage(version)).toBeNull()
  })

  it.each(['18.20.0', 'v20.11.1', '21.7.3'])('%s は理由を返す', version => {
    expect(unsupportedNodeMessage(version)).toContain(String(MINIMUM_NODE_MAJOR))
  })

  it('現在のバージョンを添える（何を上げればよいか分かるように）', () => {
    expect(unsupportedNodeMessage('18.20.0')).toContain('18.20.0')
  })

  /**
   * 判定できないことを理由に止めると、実際には動く環境で使えなくなる。
   * 止めるのは「古いと確かめられたとき」だけにする
   */
  it.each(['', 'unknown', null, undefined])('%p は読み取れないので通す', version => {
    expect(unsupportedNodeMessage(version)).toBeNull()
  })

  it('境界は下限そのものを含む', () => {
    expect(unsupportedNodeMessage('5.0.0', 5)).toBeNull()
    expect(unsupportedNodeMessage('4.9.9', 5)).not.toBeNull()
  })
})

/**
 * engines は npm install の警告、MINIMUM_NODE_MAJOR は実行時の中止に使う。
 * 片方だけ上げると「install は通るのに走らない」「走るのに警告が出る」がすれ違う
 */
describe('package.json との一致', () => {
  const enginesOf = relativePath => {
    const path = fileURLToPath(new URL(relativePath, import.meta.url))
    return JSON.parse(readFileSync(path, 'utf8')).engines.node
  }

  it('pugkit の engines が MINIMUM_NODE_MAJOR と揃っている', () => {
    expect(enginesOf('../../package.json')).toBe(`>=${MINIMUM_NODE_MAJOR}.0.0`)
  })

  it('create-pugkit の engines も揃っている', () => {
    expect(enginesOf('../../../create-pugkit/package.json')).toBe(`>=${MINIMUM_NODE_MAJOR}.0.0`)
  })
})
