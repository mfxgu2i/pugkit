import { describe, expect, it } from 'vitest'
import { DependencyGraph } from '../../core/graph.mjs'
import { resolveRebuildTargets } from '../../utils/rebuild-targets.mjs'

/**
 * 変更されたファイルから「作り直すエントリ」を決める。
 *
 * ファイル名（`_` 始まりかどうか）では判断できない。
 * `tokens.scss` や `shared.js` のように「それ自体エントリで、かつ他からも
 * 参照される」共有ファイルは名前では見分けられず、名前で判断すると
 * 依存側が作り直されないまま古い出力が残る。
 */
const ENTRIES = ['/src/a.scss', '/src/b.scss', '/src/c.scss']

function graphOf(edges) {
  const graph = new DependencyGraph()
  for (const [parent, dependency] of edges) graph.addDependency(parent, dependency)
  return graph
}

describe('作り直す対象', () => {
  it('エントリ自身の変更ならそれだけ', () => {
    const graph = graphOf([['/src/a.scss', '/src/_vars.scss']])

    expect(resolveRebuildTargets('/src/a.scss', ENTRIES, graph)).toEqual(['/src/a.scss'])
  })

  it('パーシャルの変更なら依存しているエントリだけ', () => {
    const graph = graphOf([
      ['/src/a.scss', '/src/_vars.scss'],
      ['/src/b.scss', '/src/_other.scss']
    ])

    expect(resolveRebuildTargets('/src/_vars.scss', ENTRIES, graph)).toEqual(['/src/a.scss'])
  })

  it('「_」が付かない共有ファイルでも依存しているエントリを作り直す', () => {
    // それ自体エントリでもあり、他からも参照されるファイル
    const graph = graphOf([['/src/b.scss', '/src/a.scss']])

    expect(resolveRebuildTargets('/src/a.scss', ENTRIES, graph).sort()).toEqual(['/src/a.scss', '/src/b.scss'])
  })

  it('入れ子の依存もたどる', () => {
    const graph = graphOf([
      ['/src/a.scss', '/src/_mid.scss'],
      ['/src/_mid.scss', '/src/_deep.scss']
    ])

    expect(resolveRebuildTargets('/src/_deep.scss', ENTRIES, graph)).toEqual(['/src/a.scss'])
  })

  it('エントリでないものは対象に含めない', () => {
    const graph = graphOf([
      ['/src/a.scss', '/src/_vars.scss'],
      ['/src/_mid.scss', '/src/_vars.scss']
    ])

    expect(resolveRebuildTargets('/src/_vars.scss', ENTRIES, graph)).toEqual(['/src/a.scss'])
  })
})

describe('グラフが足りないとき', () => {
  it('まだ何も登録されていなければ全部作り直す（初回）', () => {
    expect(resolveRebuildTargets('/src/_vars.scss', ENTRIES, new DependencyGraph())).toEqual(ENTRIES)
  })

  it('知らないファイルなら全部作り直す（新しく追加された）', () => {
    const graph = graphOf([['/src/a.scss', '/src/_vars.scss']])

    expect(resolveRebuildTargets('/src/_new.scss', ENTRIES, graph)).toEqual(ENTRIES)
  })

  it('知っているファイルで依存元にエントリが無ければ何もしない', () => {
    // 誰からも使われなくなったパーシャル。全ビルドに退行させない
    const graph = graphOf([['/src/_mid.scss', '/src/_vars.scss']])

    expect(resolveRebuildTargets('/src/_vars.scss', ENTRIES, graph)).toEqual([])
  })
})
