import browserslist from 'browserslist'
import { browserslistToTargets } from 'lightningcss'

/**
 * CSS の変換対象ブラウザ。
 *
 * Lightning CSS は「どこまで古いブラウザを見るか」で、ベンダープレフィックスの
 * 有無と、モダンな構文をどこまで古い書き方へ降ろすかを決める。指定が無いまま
 * 既定に倒れると、案件ごとの要件と食い違ったCSSが黙って出る。
 *
 * 問い合わせ先は browserslist に一本化する。`.browserslistrc` と
 * `package.json` の `browserslist` を同じ規則で読むので、pugkit が
 * 独自の設定項目を持つとそちらとずれる。
 */
export function resolveCssTargets(root) {
  // 第1引数を渡さないと、path から設定を探し、無ければ browserslist の既定に倒れる
  return browserslistToTargets(browserslist(undefined, { path: root }))
}
