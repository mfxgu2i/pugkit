import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { imageDimensionsFromData } from 'image-dimensions'

/**
 * 画像ファイルから実寸を読む。
 *
 * ラスタは image-dimensions に任せ、SVG だけ自前で読む。image-dimensions は
 * 画素の並びを持つ形式しか見ないため、SVG は開始タグの属性から寸法を決める。
 *
 * 寸法は HTML の width/height 属性になるので整数に丸める。小数を書くと
 * ブラウザが計算する縦横比が画像と 1px ずれ、CLS の原因になる
 */

/** SVG の length 属性に付く単位と px 換算 */
const UNITS = { px: 1, cm: 37.8, mm: 3.78, in: 96, pt: 1.33, pc: 16, em: 16, ex: 8 }

const LENGTH_RE = new RegExp(`^(\\d*\\.?\\d+)(${Object.keys(UNITS).join('|')})?$`, 'i')

/** 開始タグだけを見る。属性値に「>」が入る SVG は実際上ない */
const SVG_TAG_RE = /<svg\s[^>]*>/i

/**
 * 属性を 1 つ読む。値は引用符付きのものだけを見る。
 *
 * viewBox は SVG では大小を区別するが、綴りを間違えた SVG まで拾えたほうが
 * 「寸法が読めない」で落ちるより親切なので、区別せずに探す
 */
function attributeOf(tag, name) {
  return new RegExp(`\\s${name}\\s*=\\s*(['"])(.*?)\\1`, 'i').exec(tag)?.[2]
}

/**
 * width / height 属性を px に直す。読み取れないものは undefined。
 *
 * `100%` のような相対値は、それ自体では大きさが決まらないので読めないものとして扱う
 * （viewBox があればそちらから決まる）
 */
function toPixels(value) {
  if (!value) return undefined

  const matched = LENGTH_RE.exec(value.trim())
  if (!matched) return undefined

  const [, number, unit = 'px'] = matched
  return Number.parseFloat(number) * UNITS[unit.toLowerCase()]
}

/** viewBox の 3 番目と 4 番目。区切りは空白でもカンマでもよい（SVG の仕様どおり） */
function viewBoxOf(tag) {
  const values = attributeOf(tag, 'viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)

  if (!values || values.length !== 4 || values.some(Number.isNaN)) return undefined

  const [, , width, height] = values
  return width > 0 && height > 0 ? { width, height } : undefined
}

/**
 * SVG の寸法。読み取れなければ undefined。
 *
 * width / height が片方だけのときは viewBox の縦横比で埋める。両方無ければ viewBox そのもの。
 * ブラウザが描くときと同じ決め方にしないと、書いた width/height と表示が食い違う
 */
function svgSizeOf(text) {
  const tag = SVG_TAG_RE.exec(text)?.[0]
  if (!tag) return undefined

  const width = toPixels(attributeOf(tag, 'width'))
  const height = toPixels(attributeOf(tag, 'height'))
  if (width && height) return { width, height }

  const viewBox = viewBoxOf(tag)
  if (!viewBox) return undefined

  const ratio = viewBox.width / viewBox.height
  if (width) return { width, height: width / ratio }
  if (height) return { width: height * ratio, height }
  return viewBox
}

/**
 * ファイルの実寸を { width, height, type } で返す。読み取れなければ例外。
 *
 * 例外にするのは、寸法が無いまま先へ進むと width/height の無い img が出て、
 * 読み込み中にレイアウトが動くため。呼び出し側でどの参照が読めなかったかを添えて知らせる
 */
export function imageSizeOf(filePath) {
  const data = readFileSync(filePath)
  const isSvg = extname(filePath).toLowerCase() === '.svg'
  const size = isSvg ? svgSizeOf(data.toString('utf8')) : imageDimensionsFromData(new Uint8Array(data))

  if (!size) throw new Error('unsupported or corrupt image data')

  return {
    width: Math.round(size.width),
    height: Math.round(size.height),
    // 呼び出し側は imageInfo() の format としてそのまま返す。JPEG の綴りは jpg に寄せる
    type: isSvg ? 'svg' : size.type === 'jpeg' ? 'jpg' : size.type
  }
}
