/**
 * 動作対象の Node.js。
 *
 * package.json の engines は npm install で警告が出るだけで、実行は止まらない。
 * 古い Node で走らせると、依存のどれかが構文エラーや不明な API で落ちて、
 * pugkit 側の不具合に見える形で失敗する。入口で判定して理由を伝える。
 *
 * メジャーだけでなくパッチまで見るのは、依存（js-beautify → nopt）が
 * 22 系のセキュリティ更新を当てたものを要求するため。22.20 のような古いパッチだと
 * npm install で engines の警告が出る
 *
 * この値と package.json の engines は必ず揃える（test/unit/node-version.test.mjs）
 */
export const MINIMUM_NODE_VERSION = '22.22.2'

/** "v22.20.0" のような綴りを [22, 20, 0] にする。読み取れない桁は null */
function parseVersion(version) {
  const parts = String(version)
    .replace(/^v/, '')
    .split('.')
    .slice(0, 3)
    .map(part => Number.parseInt(part, 10))

  return parts.length === 3 && parts.every(Number.isInteger) ? parts : null
}

/** 上の桁から順に比べ、差がついたところで決める */
function isOlder(current, floor) {
  for (let index = 0; index < floor.length; index++) {
    if (current[index] !== floor[index]) return current[index] < floor[index]
  }

  return false
}

/**
 * 動かせない Node なら理由を返す。動かせるなら null。
 *
 * @param version process.versions.node 相当。"22.20.0" でも "v22.20.0" でも良い
 */
export function unsupportedNodeMessage(version, minimum = MINIMUM_NODE_VERSION) {
  const current = parseVersion(version)
  const floor = parseVersion(minimum)

  // 読み取れないときは通す。判定できないことを理由に止めると、
  // 実際には動く環境で使えなくなる
  if (!current || !floor) return null
  if (!isOlder(current, floor)) return null

  return `pugkit は Node.js ${minimum} 以上が必要です。現在のバージョンは ${version} です`
}
