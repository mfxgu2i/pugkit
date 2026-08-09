/**
 * 動作対象の Node.js。
 *
 * package.json の engines は npm install で警告が出るだけで、実行は止まらない。
 * 古い Node で走らせると、依存のどれかが構文エラーや不明な API で落ちて、
 * pugkit 側の不具合に見える形で失敗する。入口で判定して理由を伝える。
 *
 * この値と package.json の engines は必ず揃える（test/unit/node-version.test.mjs）
 */
export const MINIMUM_NODE_MAJOR = 22

/**
 * 動かせない Node なら理由を返す。動かせるなら null。
 *
 * @param version process.versions.node 相当。"22.20.0" でも "v22.20.0" でも良い
 */
export function unsupportedNodeMessage(version, minimum = MINIMUM_NODE_MAJOR) {
  const major = Number.parseInt(String(version).replace(/^v/, ''), 10)

  // 読み取れないときは通す。判定できないことを理由に止めると、
  // 実際には動く環境で使えなくなる
  if (!Number.isInteger(major)) return null
  if (major >= minimum) return null

  return `pugkit は Node.js ${minimum} 以上が必要です。現在のバージョンは ${version} です`
}
