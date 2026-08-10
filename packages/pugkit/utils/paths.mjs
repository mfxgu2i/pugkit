import { isAbsolute, resolve } from 'node:path'

/** build の出力先の既定値。設定の既定値と BuildContext のフォールバックで共有する */
export const DEFAULT_OUT_DIR = 'dist'

/**
 * 設定に書かれたディレクトリを絶対パスへ解決する。
 * 相対ならプロジェクトルート起点、絶対ならそのまま。
 *
 * outDir も cacheDir も中身を丸ごと削除される対象で、解決の規則がずれると
 * 「安全か検査した場所」と「実際に消す場所」が食い違う。書き分けずにここへ集める
 */
export function resolveFromRoot(root, dir) {
  return isAbsolute(dir) ? dir : resolve(root, dir)
}
