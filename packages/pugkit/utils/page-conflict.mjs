import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'

/**
 * src の Pug と public の HTML が同じ URL を取り合うときの規則。
 *
 * build は pug のあとに copy を走らせるので、同名なら public 側が残る。
 * dev もこれに合わせないと「dev では自分の書いたページ、本番では public の中身」
 * という食い違いになるため、どちらが勝つかの判定はここ一箇所に置く。
 */
const PUG_EXT = '.pug'
const HTML_EXT = '.html'

/** この Pug の出力を上書きする public 側のファイル。無ければ null */
export function publicOverrideFor(pugFile, paths) {
  const rel = relative(paths.src, pugFile)
  if (!rel.endsWith(PUG_EXT)) return null

  const candidate = resolve(paths.public, rel.slice(0, -PUG_EXT.length) + HTML_EXT)
  return existsSync(candidate) ? candidate : null
}

/** この public ファイルが上書きしてしまう Pug。無ければ null */
export function overriddenPugFor(publicFile, paths) {
  const rel = relative(paths.public, publicFile)
  if (!rel.endsWith(HTML_EXT)) return null

  const candidate = resolve(paths.src, rel.slice(0, -HTML_EXT.length) + PUG_EXT)
  return existsSync(candidate) ? candidate : null
}
