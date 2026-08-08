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
