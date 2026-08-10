/**
 * 画像形式の集合。
 *
 * 「どの拡張子がどの扱いになるか」は、glob（走査する対象）・正規表現（変更を検知した
 * ファイルの種別判定）・拡張子の読み替えという別々の形で必要になる。同じ集合を
 * それぞれの場所で書き下すと、片方だけ増えたときに気づけない
 * （src に置いたのに出力されない・変更しても再ビルドされない、という無音の壊れ方をする）。
 *
 * 集合をここに置き、glob と正規表現はそこから導く。
 */

const toRe = extensions => new RegExp(`\\.(${extensions.join('|')})$`, 'i')
const toGlob = extensions => `**/*.{${extensions.join(',')}}`

/** image タスクが変換・出力する形式 */
export const CONVERTIBLE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif']

/**
 * 密度（縮小版）を適用する形式。
 * GIF は sharp のアニメーション対応を入れていないため、縮小すると 1 コマ目に潰れる
 */
export const DENSITY_EXTENSIONS = ['jpg', 'jpeg', 'png']

/**
 * 変換先の形式。src に置かれても image タスクの担当にならず、
 * svg タスクの対象でもなく、copy は public しか見ないため出力に出ない
 */
export const UNHANDLED_EXTENSIONS = ['webp', 'avif']

/**
 * imageInfo() が寸法を読む対象。変換対象より広く、
 * すでに webp/avif/svg になっているものも含む
 */
export const MEASURABLE_EXTENSIONS = [...CONVERTIBLE_EXTENSIONS, ...UNHANDLED_EXTENSIONS, 'svg']

/**
 * 画像として出力されうる拡張子。予約サフィックスの検査対象を絞るために使う。
 *
 * SVG は入らない。ベクターなので密度も幅も適用されず、`@half.svg` や `@400w.svg` を
 * ビルドが作ることはないため、その名前を予約する理由が無い
 */
export const OUTPUT_EXTENSIONS = [...CONVERTIBLE_EXTENSIONS, ...UNHANDLED_EXTENSIONS]

export const CONVERTIBLE_EXT_RE = toRe(CONVERTIBLE_EXTENSIONS)
export const DENSITY_EXT_RE = toRe(DENSITY_EXTENSIONS)
export const MEASURABLE_EXT_RE = toRe(MEASURABLE_EXTENSIONS)
export const OUTPUT_EXT_RE = toRe(OUTPUT_EXTENSIONS)

export const CONVERTIBLE_GLOB = toGlob(CONVERTIBLE_EXTENSIONS)
export const UNHANDLED_GLOB = toGlob(UNHANDLED_EXTENSIONS)

/** image タスクが変換する形式か（＝ watcher が image として扱う対象） */
export function isConvertibleImage(name) {
  return CONVERTIBLE_EXT_RE.test(name)
}

/** imageInfo() が寸法を読みうる形式か */
export function isMeasurableImage(name) {
  return MEASURABLE_EXT_RE.test(name)
}
