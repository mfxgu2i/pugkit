import { describe, it, expect } from 'vitest'
import { checkMarkup } from '../../core/check/markup.mjs'

/**
 * markuplint が入っていない環境の挙動。
 * このリポジトリには devDependency として入っているので、読み込みを差し替えて確かめる。
 * 読み込みに失敗した時点で戻るため、ファイルには触らない。
 */
const context = { paths: { root: '/nowhere', outputRoot: '/nowhere/dist' } }

describe('markuplint が入っていないとき', () => {
  it('検査せずに知らせる。違反ではないので findings は空', async () => {
    const { findings, notices } = await checkMarkup(context, { load: async () => null })

    expect(findings).toEqual([])
    expect(notices.join('\n')).toMatch(/markuplint が入っていない/)
  })
})
