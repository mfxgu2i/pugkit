import path from 'node:path'
import { resolvePageFile } from '../../utils/page-candidates.mjs'

/**
 * リクエストURLを src 内の Pug ソースに解決する。
 * 対象外（非HTML・subdir不一致・「_」始まりセグメント・src外・ファイル無し）は null。
 *
 * 候補順は sirv の解決順に合わせる（page-candidates.mjs を参照）。
 */
export function resolvePugSource(urlPath, paths, subdir = '') {
  const p = stripSubdir(urlPath, subdir)
  if (p === null) return null

  return resolvePageFile(p, paths.src, '.pug', {
    // パーシャル・「_」始まりディレクトリはページとして配信しない
    accept: abs =>
      !path
        .relative(paths.src, abs)
        .split(path.sep)
        .some(segment => segment.startsWith('_'))
  })
}

/**
 * subdir の前置きを外す。境界チェック付きで、/sub と /sub/... のみ対象
 * （/subfoo は不一致）。一致しなければ null。
 */
function stripSubdir(urlPath, subdir) {
  if (!subdir) return urlPath
  if (urlPath === subdir) return '/'
  if (urlPath.startsWith(`${subdir}/`)) return urlPath.slice(subdir.length)

  return null
}
