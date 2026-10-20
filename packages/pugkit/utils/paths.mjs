import { realpathSync } from 'node:fs'
import { isAbsolute, parse, resolve } from 'node:path'

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

/**
 * プロジェクトルートを絶対パスにする。
 *
 * Windows では、cwd 由来のパスと glob や Sass が返すパスとで、ドライブレターや
 * 大文字小文字の綴りが食い違う（`c:\proj` と `C:\proj`）。依存グラフや画像の幅は
 * パス文字列をキーにしているので、食い違うと再ビルドや幅違い画像の出力が黙って漏れる。
 *
 * realpath はシンボリックリンクも解決するので、POSIX では使わない。macOS の /tmp が
 * /private/tmp に変わるなど、利用者が渡したパスとログやエラーの表示がずれる。
 * Windows でも subst やネットワークドライブは実体（`\\server\share`）に解決されるので、
 * ドライブが変わるときは採らない
 */
export function resolveRoot(root) {
  const absolute = resolve(root)
  if (process.platform !== 'win32') return absolute

  try {
    const real = realpathSync.native(absolute)
    return isSameDrive(real, absolute) ? real : absolute
  } catch {
    return absolute
  }
}

function isSameDrive(a, b) {
  return parse(a).root.toLowerCase() === parse(b).root.toLowerCase()
}
