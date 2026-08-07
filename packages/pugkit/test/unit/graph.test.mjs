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

    it('他のファイルがこのファイルに依存している関係は消さない', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/page.pug', '/_layout.pug')

      // /_layout.pug 自身の依存を登録し直すだけ。
      // 「page が layout に依存している」は page 側の情報なので残す
      graph.clearDependencies('/_layout.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual(['/page.pug'])
    })
  })

  describe('removeFile', () => {
    it('ファイル削除時は双方向の依存を消す', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/page.pug', '/_layout.pug')

      graph.removeFile('/_layout.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
      // 親の依存一覧からも消える（残っていると同名で作り直したとき古い辺が復活する）
      expect(graph.edges.get('/page.pug')?.has('/_layout.pug')).toBeFalsy()
    })

    it('自分が持つ依存も消す', () => {
      const graph = new DependencyGraph()
      graph.addDependency('/page.pug', '/_layout.pug')

      graph.removeFile('/page.pug')

      expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
    })
  })

  // 相互に依存する2ファイルの依存を順に登録し直すケース。
  // 「依存としての親をクリア」が直前に登録した辺を巻き添えにすると、
  // 変更しても再ビルドされないファイルが出る
  it('あるファイルの依存を登録し直しても、他のファイルの依存は壊さない', () => {
    const graph = new DependencyGraph()

    graph.clearDependencies('/a.js')
    graph.addDependency('/a.js', '/b.js')

    graph.clearDependencies('/b.js')
    graph.addDependency('/b.js', '/a.js')

    // 相互依存なので互いが影響を受ける。片方でも欠けると変更が反映されない
    expect(graph.getAffectedParents('/b.js')).toContain('/a.js')
    expect(graph.getAffectedParents('/a.js')).toContain('/b.js')
  })

  it('clear ですべての依存が消える', () => {
    const graph = new DependencyGraph()
    graph.addDependency('/page.pug', '/_layout.pug')

    graph.clear()

    expect(graph.getAffectedParents('/_layout.pug')).toEqual([])
  })
})
