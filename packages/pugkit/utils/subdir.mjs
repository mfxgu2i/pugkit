/**
 * subdir の表記ゆれを吸収する。前後のスラッシュを落とし、'sub' の形にそろえる。
 *
 * 先頭スラッシュが残ると resolve() が絶対パス扱いし、出力先が outDir の外に出る。
 * 使う側がそれぞれ整形すると規則が食い違うので、ここ一箇所に置く。
 */
export function normalizeSubdir(value) {
  return String(value ?? '').replace(/^[/\\]+|[/\\]+$/g, '')
}

/** URL の前置きに使う形。空なら空文字、それ以外は先頭にスラッシュを付ける */
export function subdirPrefix(value) {
  const normalized = normalizeSubdir(value)
  return normalized ? `/${normalized}` : ''
}

/**
 * subdir の前置きを外す。境界チェック付きで、/sub と /sub/... のみ対象
 * （/subfoo は不一致）。一致しなければ null。
 *
 * dev のページ配信・幅違いのリクエスト時生成・imageInfo のルート相対解決が、
 * 同じ規則で解く必要がある。書き写すと境界の判定が三重定義になる。
 *
 * @param urlPath 「/」始まりの URL パス
 * @param subdir subdirPrefix() が作った形。'/sub' か空文字
 */
export function stripSubdir(urlPath, subdir) {
  if (!subdir) return urlPath
  if (urlPath === subdir) return '/'
  if (urlPath.startsWith(`${subdir}/`)) return urlPath.slice(subdir.length)

  return null
}
