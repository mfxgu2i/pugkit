/**
 * 依存関係グラフ
 * Pugのパーシャル依存を管理
 */
export class DependencyGraph {
  constructor() {
    this.edges = new Map() // 親 -> Set<依存>
    this.reverseEdges = new Map() // 依存 -> Set<親>
  }

  /**
   * 依存関係を追加
   */
  addDependency(parent, dependency) {
    // 親 -> 依存
    if (!this.edges.has(parent)) {
      this.edges.set(parent, new Set())
    }
    this.edges.get(parent).add(dependency)

    // 依存 -> 親（逆引き）
    if (!this.reverseEdges.has(dependency)) {
      this.reverseEdges.set(dependency, new Set())
    }
    this.reverseEdges.get(dependency).add(parent)
  }

  /**
   * パーシャル変更時に再ビルドが必要な親ファイルを取得
   */
  getAffectedParents(dependency) {
    const affected = new Set()
    const queue = [dependency]
    const visited = new Set()

    while (queue.length > 0) {
      const current = queue.shift()

      if (visited.has(current)) {
        continue
      }
      visited.add(current)

      const parents = this.reverseEdges.get(current)

      if (parents) {
        parents.forEach(parent => {
          affected.add(parent)
          // 連鎖的な依存もチェック
          queue.push(parent)
        })
      }
    }

    return Array.from(affected)
  }

  /**
   * ファイルの依存関係をクリア
   */
  clearDependencies(file) {
    // 親としての依存をクリア
    const deps = this.edges.get(file)
    if (deps) {
      deps.forEach(dep => {
        const parents = this.reverseEdges.get(dep)
        if (parents) {
          parents.delete(file)
          if (parents.size === 0) {
            this.reverseEdges.delete(dep)
          }
        }
      })
      this.edges.delete(file)
    }

    // 依存としての親をクリア
    const parents = this.reverseEdges.get(file)
    if (parents) {
      parents.forEach(parent => {
        const deps = this.edges.get(parent)
        if (deps) {
          deps.delete(file)
        }
      })
      this.reverseEdges.delete(file)
    }
  }

  /**
   * すべてのグラフをクリア
   */
  clear() {
    this.edges.clear()
    this.reverseEdges.clear()
  }
}
