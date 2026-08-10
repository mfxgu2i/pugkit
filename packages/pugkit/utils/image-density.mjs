import { extname } from 'node:path'
import { CONVERTIBLE_EXT_RE, DENSITY_EXT_RE } from './image-formats.mjs'

/**
 * 画像の出力名と寸法の規則。密度（@half）と幅（@400w）の両方を持つ。
 *
 * 生成側（tasks/image.mjs）と参照側（transform/image-size.mjs）が同じ規則を使わないと、
 * HTML に書く width/height と実際に出力された画像の寸法がずれて CLS になる。
 * 出力先の導出を imageOutputPaths に一本化しているのと同じ理由で、ここに集める。
 *
 * 幅モードでは出力先を相対パスだけから列挙できない（幅は呼び出し側が決めるため）。
 * 削除側と衝突検査がそれぞれ別の手で解くことになるので、名前の規則だけはここに集約する
 * （docs/adr/0011）。
 *
 * 対象の拡張子そのものは utils/image-formats.mjs に置く（glob や種別判定でも要るため）。
 */

export const VALID_SOURCE_DENSITIES = [1, 2]

export const DEFAULT_SOURCE_DENSITY = 2

/**
 * 未知の値は 1（縮小しない）に倒す。2 に倒すと、等倍素材のプロジェクトで
 * 全画像が半分の寸法になるという静かな壊れ方をする
 */
export function normalizeSourceDensity(value) {
  return VALID_SOURCE_DENSITIES.includes(value) ? value : null
}

/**
 * config から密度を取り出す。未設定・不正値は 1（縮小しない）。
 * ここで倒しておかないと、密度が undefined のまま比較に使われて
 * 「1 枚も出力されない」という無音の壊れ方をする
 */
export function sourceDensityOf(config) {
  return normalizeSourceDensity(config?.build?.image?.sourceDensity) ?? 1
}

export function scaleDown(n, density) {
  return Math.max(1, Math.round(n / density))
}

/**
 * 縮小しても寸法が変わらない画像は 2 枚目を作らない。
 * 1x1 のような画像で、同じ寸法のファイルを 2 枚配って srcset の記述子だけ嘘になるのを防ぐ。
 * 縦横のどちらかしか縮まない場合も、アスペクト比が崩れるので作らない
 */
export function hasScaledVariant(width, height, sourceDensity) {
  if (sourceDensity <= 1) return false
  if (!width || !height) return false
  return scaleDown(width, sourceDensity) < width && scaleDown(height, sourceDensity) < height
}

/** 密度（縮小版）を適用してよい形式か。SVG はベクターなので密度の概念が当てはまらない */
export function supportsDensity(name) {
  return DENSITY_EXT_RE.test(name)
}

/** 出力形式に応じて拡張子を読み替える。変換対象外はそのまま */
export function convertExtension(name, format) {
  if (format !== 'avif' && format !== 'webp') return name
  return name.replace(CONVERTIBLE_EXT_RE, `.${format}`)
}

// 縮小版のサフィックス。密度（1x）ではなく「原寸の半分」という変換内容を表す。
// @1x はデザインツールの書き出し名として実在するため、予約語にすると衝突する
const SCALED_SUFFIX = '@half'

/**
 * 縮小版の出力名。原寸は無印のままにする。
 * 無印が src と同じ寸法であることを保つと、imageInfo() を通らない参照
 * （CSS の url() 直書き・OGP・favicon）が壊れない
 */
export function scaledName(name) {
  const ext = extname(name)
  return `${name.slice(0, -ext.length)}${SCALED_SUFFIX}${ext}`
}

/**
 * 1 つのソース画像が生成しうる出力を、原寸を筆頭にして返す。
 * 実際に縮小版が作られるかは原寸に依存する（hasScaledVariant）が、
 * ここでは候補を返す。削除側は原寸を知らないため、候補すべてを消せる必要がある
 */
export function densityOutputs(name, optimization, sourceDensity) {
  const converted = convertExtension(name, optimization)
  const outputs = [{ name: converted, density: sourceDensity }]

  // 縮小版は「原寸の半分」の 1 枚だけ。sourceDensity が 1|2 に限られることが前提で、
  // 3 以上を許すなら @half という名前ごと見直すことになる
  if (sourceDensity === 2 && supportsDensity(name)) {
    outputs.push({ name: scaledName(converted), density: 1 })
  }

  return outputs
}

// 幅版のサフィックス。srcset の記述子（400w）と同じ綴りにして、
// 出力名から候補の幅が読めるようにする
const WIDTH_SUFFIX_RE = /@(\d+)w$/

/** 拡張子を除いた幹。拡張子が無い名前でも壊れないようにする */
function stemOf(name) {
  return name.slice(0, name.length - extname(name).length)
}

/** 幅版の出力名。@half と同じ族で揃える */
export function widthName(name, width) {
  return `${stemOf(name)}@${width}w${extname(name)}`
}

/**
 * 出力名から幅記述子を読む。読めなければ null。
 *
 * 削除側（core/watcher.mjs）と dev のリクエスト時生成が、同じ規則で名前を解く必要がある。
 * 片方が glob のような緩い判定を持つと、他人の出力を消す
 */
export function parseWidthName(name) {
  const ext = extname(name)
  const stem = stemOf(name)
  const match = stem.match(WIDTH_SUFFIX_RE)
  if (!match) return null

  // ビルドが作る綴りだけを読む。`@0400w` を許すと同じ幅に複数の出力先ができ、
  // dev の生成上限は「既知の幅」で数えているので先頭のゼロを増やすだけで素通りする。
  // 0 も作らない名前なので、予約にも削除の対象にも含めない
  const width = Number(match[1])
  if (width < 1 || String(width) !== match[1]) return null

  return { base: stem.slice(0, stem.length - match[0].length), width, ext }
}

/**
 * ビルドが作る名前の形か。src と public にこの形の画像を置かせない。
 *
 * 幅が呼び出し側で決まると出力先を先に列挙できないので、
 * 衝突検査はこの予約で肩代わりする（docs/adr/0011）
 */
export function isReservedImageName(name) {
  const stem = stemOf(name)
  return stem.endsWith(SCALED_SUFFIX) || WIDTH_SUFFIX_RE.test(stem)
}

/**
 * 幅違いを作ってよい形式か。密度と同じ集合を使う。
 * 呼ぶ側の意図が読めるように別名で置く
 */
export function supportsWidthVariants(name) {
  return supportsDensity(name)
}

/**
 * 呼び出し側から渡された widths を正規化する。昇順にして重複を除く。
 *
 * 使えない値は落として dropped に入れる。黙って消すと、
 * 書いた幅が出力に現れないことに気づけない
 */
export function normalizeWidths(value) {
  if (value === undefined || value === null) return { widths: [], dropped: [] }
  if (!Array.isArray(value)) return { widths: [], dropped: [value] }

  const widths = new Set()
  const dropped = []

  for (const entry of value) {
    if (Number.isInteger(entry) && entry > 0) widths.add(entry)
    else dropped.push(entry)
  }

  return { widths: [...widths].sort((a, b) => a - b), dropped }
}

/**
 * 原寸以上の幅は作らない。拡大しても情報は増えず、
 * 原寸と同じ幅は無印が兼ねるので同じ中身が 2 枚出る
 */
export function pruneWidths(widths, intrinsicWidth) {
  return intrinsicWidth ? widths.filter(width => width < intrinsicWidth) : []
}

/**
 * 幅版の寸法。縦は原寸の比率から決める。
 * 生成側と参照側でこの式を共有しないと、書いた height と実際の画像がずれる
 */
export function widthDimensions(width, height, targetWidth) {
  return { width: targetWidth, height: scaleDown(height, width / targetWidth) }
}

/**
 * 幅モードで 1 つのソース画像が生成する出力を、幅の昇順で返す。
 * 無印は原寸のままで、最大の候補を兼ねる
 */
export function widthOutputs(name, format, widths, intrinsicWidth) {
  const converted = convertExtension(name, format)
  const original = { name: converted, width: intrinsicWidth }

  if (!supportsWidthVariants(name)) return [original]

  return [...pruneWidths(widths, intrinsicWidth).map(width => ({ name: widthName(converted, width), width })), original]
}
