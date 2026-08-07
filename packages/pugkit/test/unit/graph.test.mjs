import { describe, expect, it } from 'vitest'
import { DependencyGraph } from '../../core/graph.mjs'

/**
 * 依存グラフ。パーシャル変更時に「どのページを作り直すか」を決める中核。
 * ここが漏れると変更が反映されず、余計に拾うと無駄な再ビルドになる。
 */
describe('DependencyGraph', () => {
  it('依存から親を逆引きできる', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/page.pug', '/_layout.pug')

    expect(graph.getAffectedParents('/_layout.pug')).toEqual(['/page.pug'])
  })

  it('同じ依存を持つ親をすべて返す', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/a.pug', '/_layout.pug')
    graph.addDependency('/b.pug', '/_layout.pug')

    expect(graph.getAffectedParents('/_layout.pug').sort()).toEqual(['/a.pug', '/b.pug'])
  })

  it('入れ子の依存を連鎖的にたどる', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/page.pug', '/_layout.pug')
    graph.addDependency('/_layout.pug', '/_button.pug')

    expect(graph.getAffectedParents('/_button.pug').sort()).toEqual(['/_layout.pug', '/page.pug'])
  })

  it('循環依存があっても停止する', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/a.pug', '/b.pug')
    graph.addDependency('/b.pug', '/a.pug')

    expect(graph.getAffectedParents('/a.pug').sort()).toEqual(['/a.pug', '/b.pug'])
  })

  it('知らない依存には空を返す', () => {
    expect(new DependencyGraph().getAffectedParents('/unknown.pug')).toEqual([])
  })

  it('同じ依存を二度登録しても重複しない', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/page.pug', '/_layout.pug')
    graph.addDependency('/page.pug', '/_layout.pug')

    expect(graph.getAffectedParents('/_layout.pug')).toEqual(['/page.pug'])
  })

  describe('clearDependencies', () => {
    it('親としての依存を消すと逆引きからも消える', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/page.pug', '/_layout.pug')

      graph.clearDependencies('/page.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
    })

    it('他の親の依存は残す', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/a.pug', '/_layout.pug')
      graph.addDependency('/b.pug', '/_layout.pug')

      graph.clearDependencies('/a.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual(['/b.pug'])
    })

    it('依存として消すと親側の登録も消える', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/page.pug', '/_layout.pug')

      // パーシャル自身が削除されたケース
      graph.clearDependencies('/_layout.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
      // 再登録しても古い辺が復活しない
      graph.addDependency('/page.pug', '/_other.pug')
      expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
    })
  })

  it('clear ですべての依存が消える', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/page.pug', '/_layout.pug')

    graph.clear()

    expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
  })
})
