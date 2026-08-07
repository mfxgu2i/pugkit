/**
 * 変更されたファイルから、作り直すべきエントリを決める。
 *
 * 「`_` 始まりならパーシャル」はファイル名の規約であって依存関係ではない。
 * `tokens.scss` や `shared.js` のように「それ自体エントリでもあり、他からも
 * 参照される」共有ファイルは名前では見分けられないため、依存グラフで判断する。
 *
 * @param changedFile   変更されたファイル（絶対パス）
 * @param allEntryFiles ビルド対象のエントリ一覧
 * @param graph         そのタスクの依存グラフ
 */
export function resolveRebuildTargets(changedFile, allEntryFiles, graph) {
  const affected = new Set([changedFile, ...graph.getAffectedParents(changedFile)])
  const targets = allEntryFiles.filter(file => affected.has(file))

  // グラフがそのファイルを知らないのは、まだ一度もビルドしていないか、
  // 新しく追加されたとき。誰が参照しているか分からないので安全側に倒す
  if (targets.length === 0 && !graph.has(changedFile)) return allEntryFiles

  return targets
}
