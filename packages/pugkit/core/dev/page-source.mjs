import path from 'node:path'
import { existsSync } from 'node:fs'

/**
 * リクエストURLを src 内の Pug ソースに解決する。
 * 対象外（非HTML・subdir不一致・「_」始まりセグメント・src外・ファイル無し）は null。
 *
 * 候補順は sirv の解決順（フラットファイル優先。末尾スラッシュは除去して同順）に合わせる:
 *   /foo.html  -> src/foo.pug
 *   /foo       -> src/foo.pug -> src/foo/index.pug
 *   /foo/      -> src/foo.pug -> src/foo/index.pug
 *   /          -> src/index.pug
 */
export function resolvePugSource(urlPath, paths, subdir = '') {
  let p = urlPath

  if (subdir) {
    // 境界チェック: /sub と /sub/... のみ対象（/subfoo は不一致）
    if (p === subdir) p = '/'
    else if (p.startsWith(subdir + '/')) p = p.slice(subdir.length)
    else return null
  }

  if (!p.startsWith('/')) return null

  // sirv 互換: 末尾スラッシュは除去して解決（/foo/ と /foo は同じ候補順）
  if (p !== '/' && p.endsWith('/')) p = p.replace(/\/+$/, '')

  const candidates = []
  if (p === '/') {
    candidates.push('/index.pug')
  } else if (/\.html$/i.test(p)) {
    candidates.push(p.replace(/\.html$/i, '.pug'))
  } else if (!path.posix.extname(p)) {
    candidates.push(p + '.pug', p + '/index.pug')
  } else {
    return null
  }

  for (const rel of candidates) {
    const abs = path.resolve(paths.src, '.' + rel)

    // src 封じ込め（パストラバーサル対策）
    if (abs !== paths.src && !abs.startsWith(paths.src + path.sep)) continue

    // パーシャル・「_」始まりディレクトリはページとして配信しない
    const relFromSrc = path.relative(paths.src, abs)
    if (relFromSrc.split(path.sep).some(seg => seg.startsWith('_'))) continue

    if (existsSync(abs)) return abs
  }

  return null
}

