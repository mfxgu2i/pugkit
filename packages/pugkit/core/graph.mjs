/**
 * 依存関係グラフ
 * Pug・Sass・Script のパーシャル依存を管理
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
   * このファイルについて依存関係を知っているか（親としても依存先としても）。
   * 「依存が無い」と「まだ何も分かっていない」を区別するために使う
   */
  has(file) {
    return this.edges.has(file) || this.reverseEdges.has(file)
  }

  /**
   * パーシャル変更時に再ビルドが必要な親ファイルを取得
   */
  getAffectedParents(dependency) {
    const affected = new Set()
    // キューに入れる前に既訪問か確かめるので、各ノードは高々1回しか処理されない。
    // 循環参照（JS の相互 import など）があっても停止する
    const queued = new Set([dependency])
    const queue = [dependency]

    while (queue.length > 0) {
      const parents = this.reverseEdges.get(queue.shift())
      if (!parents) continue

      for (const parent of parents) {
        affected.add(parent)
        // 連鎖的な依存もたどる
        if (!queued.has(parent)) {
          queued.add(parent)
          queue.push(parent)
        }
      }
    }

    return Array.from(affected)
  }

  /**
   * ファイルが持つ依存をクリアする（依存を登録し直す前に呼ぶ）。
   *
   * 「このファイルが誰に依存しているか」だけを消す。
   * 「誰がこのファイルに依存しているか」は他のファイルが持つ情報なので触らない
   * （消すと、そのファイルを作り直すまで復元されず、変更が反映されなくなる）。
   */
  clearDependencies(file) {
    const deps = this.edges.get(file)
    if (!deps) return

    for (const dep of deps) {
      const parents = this.reverseEdges.get(dep)
      if (!parents) continue

      parents.delete(file)
      if (parents.size === 0) this.reverseEdges.delete(dep)
    }

    this.edges.delete(file)
  }

  /**
   * ファイルをグラフから完全に取り除く（ファイル自体が削除されたときに呼ぶ）。
   * 双方向の辺を消す。
   */
  removeFile(file) {
    this.clearDependencies(file)

    const parents = this.reverseEdges.get(file)
    if (!parents) return

    for (const parent of parents) {
      this.edges.get(parent)?.delete(file)
    }

    this.reverseEdges.delete(file)
  }

  /**
   * すべてのグラフをクリア
   */
  clear() {
    this.edges.clear()
    this.reverseEdges.clear()
  }
}
