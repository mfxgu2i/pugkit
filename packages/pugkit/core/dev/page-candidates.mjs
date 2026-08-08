import path from 'node:path'
import { existsSync } from 'node:fs'
import { contains } from '../../utils/safe-dir.mjs'

/**
 * URL をページの候補ファイルに展開する。
 *
 * 候補順は sirv（= 本番の静的配信）の解決順に合わせる。
 * フラットファイル優先で、末尾スラッシュは除去して同順:
 *
 *   /            -> index
 *   /foo.html    -> foo
 *   /foo, /foo/  -> foo, foo/index
 *
 * ページとして扱えない URL（.html 以外の拡張子つき）は null。
 *
 * Pug ページ・public 由来の HTML・sirv の 3 経路で順序が違うと、同じ形の URL でも
 * 別のファイルが選ばれる。展開をここ一箇所に置き、拡張子だけを差し替えて共有する。
 *
 * @param urlPath  「/」始まりの URL パス（subdir は呼び出し側で処理済み）
 * @param extension 候補に付ける拡張子（'.pug' / '.html'）
 */
export function pageCandidates(urlPath, extension) {
  if (!urlPath.startsWith('/')) return null

  const p = urlPath === '/' ? '/' : urlPath.replace(/\/+$/, '') || '/'

  if (p === '/') return [`/index${extension}`]
  if (/\.html$/i.test(p)) return [p.replace(/\.html$/i, extension)]
  if (!path.posix.extname(p)) return [`${p}${extension}`, `${p}/index${extension}`]

  return null
}

/**
 * URL を root 配下の実ファイルへ解決する。見つからなければ null。
 *
 * root の外へ出る候補は捨てる（パストラバーサル対策）。候補は URL 由来なので
 * 「..」を含みうるが、resolve したあとで root の内側かを見れば形によらず弾ける。
 *
 * @param accept 追加の受け入れ条件（パーシャルの除外など）
 */
export function resolvePageFile(urlPath, root, extension, { accept } = {}) {
  const candidates = pageCandidates(urlPath, extension)
  if (!candidates) return null

  for (const candidate of candidates) {
    const abs = path.resolve(root, `.${candidate}`)

    if (!contains(root, abs)) continue
    if (accept && !accept(abs)) continue
    if (existsSync(abs)) return abs
  }

  return null
}
