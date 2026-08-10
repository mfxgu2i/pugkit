import { transform } from 'lightningcss'

/**
 * CSS から他のファイルを指す値を集める。
 *
 * 正規表現ではなく Lightning CSS の visitor を通すのは、コメントの中の url() と
 * 文字列の中の url() を区別するため。パーサは既に依存にあるので、これのために
 * 増える依存はない。
 *
 * ここで見るのは dist に出た CSS で、sass タスクが Lightning CSS を通した後のもの。
 * public に手で置いた CSS も同じ経路で見る。
 */

/**
 * 解析を続けたまま集める。
 *
 * `*zoom: 1` のような古いハックが 1 行あるだけで例外になり、その CSS の url() が
 * まるごと無検査になる。ベンダー支給の CSS を public に置く案件で実際に起きる
 */
const TRANSFORM_OPTIONS = { errorRecovery: true, minify: false }

/**
 * @returns {{ references: { value: string, line: number, column: number }[], error: string | null }}
 *   error は保険。errorRecovery を付けた transform は構文エラーを警告に変えるので、
 *   いまの Lightning CSS では通らない。それでも投げさせないのは、CSS 1 つの都合で
 *   検査全体が落ちると他のファイルの報告まで消えるため
 */
export function collectCssReferences(code, filename) {
  const references = []
  const seen = new Set()

  /** @param lineOffset @import の loc だけ行が 0 始まりで返るので 1 を足す */
  const add = (value, loc, lineOffset = 0) => {
    if (!value) return

    const line = (loc?.line ?? 1) + lineOffset
    const column = loc?.column ?? 1
    const key = `${value}:${line}:${column}`

    // url() は Url と Image の両方に届くことがある
    if (seen.has(key)) return
    seen.add(key)

    references.push({ value, line, column })
  }

  try {
    transform({
      ...TRANSFORM_OPTIONS,
      filename,
      code: Buffer.from(code),
      visitor: {
        Url(url) {
          add(url.url, url.loc)
        },
        // image-set の中の url() は Url visitor に届かない。
        // Retina 対応の背景画像はここに書かれるので、落とすと動機そのものを取り逃がす
        Image(image) {
          if (image.type !== 'image-set') return
          for (const option of image.value?.options ?? []) {
            if (option.image?.type === 'url') add(option.image.value?.url, option.image.value?.loc)
          }
        },
        // @import は Url にも Image にも来ない。行番号だけ 0 始まりで返る
        Rule(rule) {
          if (rule.type === 'import') add(rule.value?.url, rule.value?.loc, 1)
        }
      }
    })
  } catch (error) {
    return { references: [], error: error.message }
  }

  return { references, error: null }
}
