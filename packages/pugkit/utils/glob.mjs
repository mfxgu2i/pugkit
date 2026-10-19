import { glob as globWithPlatformCase } from 'glob'

/**
 * glob は Windows と macOS では既定で大文字小文字を区別せず、`*.pug` が `About.PUG` にも
 * 一致する。後段の拡張子の判定は区別するので、`dist/About.PUG` のような出力になる。
 * Linux の CI や本番と同じ結果になるよう、どの OS でも区別させる
 */
export function glob(pattern, options = {}) {
  return globWithPlatformCase(pattern, { nocase: false, ...options })
}
