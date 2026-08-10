import { Parser } from 'htmlparser2'

/**
 * HTML から他のファイルを指す値を集める。
 *
 * 正規表現で属性を拾わないのは、コメントに退避させた古いマークアップと
 * script の中の文字列を区別できないため。コメントアウトした <img src="old.jpg"> が
 * 毎回リンク切れとして報告されると、検査そのものが切られる。
 *
 * 木は作らない。要るのは開始タグの属性だけなので、受けたら捨てる。
 */

/**
 * 要素を問わず属性名で拾う。要素ごとの許可リストを持つと必ず抜けが出る
 * （<track src> を書き忘れた表は、track を使った案件でだけ検査が効かない）
 */
const URL_ATTRS = ['href', 'xlink:href', 'src', 'poster']

/**
 * meta だけは例外。OGP の URL は content 属性に入っていて href でも src でもない。
 * content を無条件に拾うと description の本文まで参照として扱うので、名前で絞る
 */
const META_URL_KEYS = new Set(['og:image', 'og:url', 'twitter:image'])

/**
 * srcset を候補ごとに分解する。
 *
 * HTML の構文解析と同じく、空白で区切って URL を取り、記述子はカンマまで読み飛ばす。
 * カンマで単純に分割すると data URI が本体の途中で切れる（base64 はカンマを含む）。
 *
 * 空白を含まないカンマ区切り（`a.png,b.png`）は 1 つの URL として扱う。
 * ブラウザも同じ解き方をするので、壊れた候補として報告されるのが正しい
 */
export function splitSrcset(value) {
  const source = String(value ?? '')
  const urls = []
  let index = 0

  while (index < source.length) {
    while (index < source.length && (/\s/.test(source[index]) || source[index] === ',')) index++
    if (index >= source.length) break

    const start = index
    while (index < source.length && !/\s/.test(source[index])) index++

    const token = source.slice(start, index)

    if (token.endsWith(',')) {
      // 記述子の無い候補。カンマの直後に次の候補が続く
      urls.push(token.replace(/,+$/, ''))
      continue
    }

    urls.push(token)
    while (index < source.length && source[index] !== ',') index++
  }

  return urls.filter(Boolean)
}

/**
 * オフセットから行・列を引くための索引。参照は 1 ファイルに何十個も出るので、
 * 1 件ごとに数え直さず行頭の位置を一度だけ作る
 */
function createLineIndex(code) {
  const starts = [0]
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') starts.push(i + 1)
  }

  return offset => {
    let low = 0
    let high = starts.length - 1

    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (starts[mid] <= offset) low = mid
      else high = mid - 1
    }

    return { line: low + 1, column: offset - starts[low] + 1 }
  }
}

/**
 * HTML に書かれた参照を、書かれた順に返す。
 *
 * 位置は属性ではなく開始タグの位置。htmlparser2 は属性ごとの位置を持たない。
 * 整形済みの HTML はタグごとに改行されるので、実用上はほぼ同じ行を指す。
 *
 * `<base href>` は参照として扱わず、相対参照の基点として返す。リンク先ではなく
 * 解決の規則を変える指定なので、実在を問うと必ず外れる。
 *
 * @returns {{ references: { value, line, column }[], baseHref: string | null }}
 */
export function collectHtmlReferences(code) {
  const positionOf = createLineIndex(code)
  const references = []
  let baseHref = null
  let parser = null

  const push = value => {
    if (!value) return
    references.push({ value, ...positionOf(parser.startIndex) })
  }

  parser = new Parser({
    onopentag(name, attribs) {
      if (name === 'base') {
        baseHref ??= attribs.href || null
        return
      }

      if (name === 'meta') {
        const key = attribs.property ?? attribs.name
        if (key && META_URL_KEYS.has(key.toLowerCase())) push(attribs.content)
        return
      }

      for (const attr of URL_ATTRS) push(attribs[attr])
      if (attribs.srcset) splitSrcset(attribs.srcset).forEach(push)
    }
  })

  parser.write(code)
  parser.end()

  return { references, baseHref }
}
