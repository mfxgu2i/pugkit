import { extname } from 'node:path'
import { CONVERTIBLE_EXT_RE, DENSITY_EXT_RE } from './image-formats.mjs'

/**
 * 画像の密度と出力名の規則。
 *
 * 生成側（tasks/image.mjs）と参照側（transform/image-size.mjs）が同じ規則を使わないと、
 * HTML に書く width/height と実際に出力された画像の寸法がずれて CLS になる。
 * 出力先の導出を imageOutputPaths に一本化しているのと同じ理由で、ここに集める。
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
  return normalizeSourceDensity(config?.build?.imageSourceDensity) ?? 1
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

/** 最適化設定に応じて拡張子を読み替える。変換対象外はそのまま */
export function convertExtension(name, optimization) {
  if (optimization !== 'avif' && optimization !== 'webp') return name
  return name.replace(CONVERTIBLE_EXT_RE, `.${optimization}`)
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
