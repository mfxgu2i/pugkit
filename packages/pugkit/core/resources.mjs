/**
 * タスクが抱える常駐リソースの置き場。
 *
 * Sass のコンパイラプロセスや esbuild のビルドコンテキストは、作るのが高くつくので
 * セッション中は使い回したい。しかしモジュール変数に置くとプロセス全体で1つになり、
 * 同じプロセスで2つ目のビルドを走らせると互いのリソースを奪い合う
 * （片方の close() がもう片方の常駐プロセスを落とす）。
 *
 * 寿命はセッション = BuildContext と同じなので、ここに持たせて close() でまとめて捨てる。
 *
 * 中身が何かは知らない。作り方はタスク側が渡し、捨て方はリソース自身が `dispose()` で持つ。
 * これにより core は「どのタスクが常駐プロセスを持つか」を知らずに済む。
 */
export class ResourceStore {
  constructor() {
    this.entries = new Map()
  }

  /**
   * key に対応するリソースを取り出す。無ければ create() で作る。
   *
   * 同期的に作る前提。非同期な初期化はリソース側が内部で Promise を抱える
   * （作成そのものを await にすると、同時に呼ばれたときに二重生成になる）
   *
   * @param key リソースの識別子
   * @param create リソースを作る関数。`dispose()` を持つものを返すこと
   */
  get(key, create) {
    if (!this.entries.has(key)) this.entries.set(key, create())
    return this.entries.get(key)
  }

  /**
   * すべて捨てる。捨てたあとに get すると作り直しになる。
   *
   * 先に一覧を空にしてから捨てるので、破棄の途中に get されても
   * 捨てられる最中のリソースは返らない
   */
  async disposeAll() {
    const resources = [...this.entries.values()]
    this.entries.clear()

    await Promise.all(resources.map(resource => resource.dispose()))
  }
}
