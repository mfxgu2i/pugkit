import path from 'node:path'
import { statSync } from 'node:fs'
import { pageCandidates } from '../../utils/page-candidates.mjs'
import { contains } from '../../utils/safe-dir.mjs'

/**
 * 出力に書かれた URL を、出力ルート配下の実ファイルへ突き合わせるための規則。
 *
 * 解決の基点は outputRoot で、output（subdir を含む方）ではない。
 * dist の中身は outputRoot/subdir/... に置かれ、URL にも /subdir/ が入るので、
 * URL をそのまま outputRoot に継ぎ足せば一致する。
 * この置き方だと、subdir 付きの案件で「/assets/...」と書いた事故も拾える。
 * 本番で 404 になる書き方なので、報告されるのが正しい。
 *
 * 解決そのものは URL に任せる。自前で組み立てると、ブラウザが解ける参照を
 * 壊れていると報告する。「..」の扱いがその例で、URL 仕様はルートを超える分を捨てるため、
 * dist 直下の `../a.png` は `/a.png` として届く
 */

/** 実ファイルの位置を URL に見立てるための架空の origin。外に出ないことの目印にも使う */
const VIRTUAL_ORIGIN = 'http://pugkit.invalid'

/** サーバー側で展開される値。実ファイルと突き合わせても意味がない */
const TEMPLATE_TAG = /\{\{|\}\}|<\?|\?>|<%|%>|\$\{/

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

const toPosix = p => p.replace(/\\/g, '/')

/**
 * 参照の生の値を、出力ルート起点の URL パスに直す。対象外なら null。
 *
 * 対象外にするのは、スキーム付き（siteUrl と一致するものを除く）・「//」始まり・
 * 「#」だけのアンカー・空文字・テンプレートタグを含む値。
 * 外部 URL を叩かないのは、結果が実行のたびに変わるとテストが書けなくなるため。
 *
 * ハッシュとクエリは URL が落とす。パーセントエンコードもここで復号する。
 * srcset の URL は encodeSrcsetUrl が空白を %20 にするので、
 * 復号しないと空白入りの支給画像がすべてリンク切れに見える。
 *
 * @param raw 属性に書かれた値
 * @param origin config.siteUrl。これと同じ origin の絶対 URL は内部として扱う
 * @param baseHref その文書の `<base href>`。相対参照の基点を差し替える
 */
export function referencePath(raw, { origin = '', outputRoot, fromFile, baseHref = null } = {}) {
  const value = String(raw ?? '').trim()

  if (!value) return null
  if (TEMPLATE_TAG.test(value)) return null
  if (value.startsWith('#')) return null
  if (value.startsWith('//')) return null

  let reference = value

  if (SCHEME.test(value)) {
    // canonical / og:image は Builder.url() が siteUrl を前置きした絶対 URL になる。
    // 飛ばすと、存在しない OGP 画像のような「SNS に貼るまで気づけない」壊れ方を逃す
    const site = String(origin ?? '').replace(/\/+$/, '')
    if (!site) return null

    if (value === site) reference = '/'
    else if (value.startsWith(`${site}/`)) reference = value.slice(site.length)
    else return null
  }

  // 相対参照は、CSS なら CSS ファイル、HTML なら HTML ファイルの位置が基点になる。
  // ブラウザの挙動がそうなので合わせる。HTML 基点で CSS を解くと正しい参照を壊れていると報告する
  const fileUrl = `${VIRTUAL_ORIGIN}/${toPosix(path.relative(outputRoot, fromFile))}`

  let base = fileUrl
  if (baseHref) {
    const resolvedBase = safeUrl(baseHref, fileUrl)
    // 外部を指す <base> なら、その文書の相対参照はすべて外部を指す
    if (!resolvedBase) return null
    base = resolvedBase.href
  }

  const resolved = safeUrl(reference, base)
  if (!resolved || resolved.origin !== VIRTUAL_ORIGIN) return null

  try {
    return decodeURIComponent(resolved.pathname)
  } catch {
    // 壊れたエスケープはそのまま突き合わせる。ここで捨てると報告が消える
    return resolved.pathname
  }
}

function safeUrl(value, base) {
  try {
    const url = new URL(value, base)
    return url.origin === VIRTUAL_ORIGIN ? url : null
  } catch {
    return null
  }
}

const isFile = absolute => statSync(absolute, { throwIfNoEntry: false })?.isFile() === true

/**
 * URL パスを出力ルート配下の実ファイルへ解決する。見つからなければ null。
 *
 * 候補の展開は utils/page-candidates.mjs と共有する。dev サーバーと同じ規則で解かないと、
 * 同じ形の URL でも検査と配信で別のファイルを見にいく。
 *
 * 展開したあとに URL そのものも試すのは、拡張子の無い実ファイル（CNAME・LICENSE）を
 * ページ候補だけで探すと見つからないため。
 *
 * ディレクトリに当たっても実在とはみなさない。本番の静的配信はディレクトリを返せない
 */
export function resolveReference(urlPath, outputRoot) {
  const candidates = pageCandidates(urlPath, '.html') ?? []

  for (const candidate of [...candidates, urlPath]) {
    const absolute = path.resolve(outputRoot, `.${candidate}`)

    // URL 仕様では出力ルートの外へは出られないが、規則が変わったときの落とし穴になるので残す
    if (!contains(outputRoot, absolute)) continue
    if (isFile(absolute)) return absolute
  }

  return null
}
