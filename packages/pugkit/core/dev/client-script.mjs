import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

/** リロード通知の購読先。クライアントには data 属性で渡す */
export const SSE_PATH = '/__pugkit_sse'

/** 注入したスクリプトの目印。dev の注入分を機械的に見分けるために使う */
export const RELOAD_ATTR = 'data-pugkit-live-reload'

/** 注入するスクリプトに埋め込む指紋の属性名。クライアントもこの名前で読む */
export const SIGNATURE_ATTR = 'data-pugkit-signature'

/**
 * idiomorph 本体（DOM 差分適用ライブラリ）をクライアントスクリプトに同梱するため読み込む。
 * dev サーバー起動時にだけ読むよう遅延化している（build では読まれない）。
 * 読めない場合は DOM 差分更新を諦めてフルリロードにフォールバックする。
 */
let idiomorphSource
function loadIdiomorphSource() {
  if (idiomorphSource === undefined) {
    try {
      const require = createRequire(import.meta.url)
      idiomorphSource = readFileSync(require.resolve('idiomorph/dist/idiomorph.min.js'), 'utf8')
    } catch {
      idiomorphSource = null
    }
  }
  return idiomorphSource
}

/**
 * body の差分適用で反映できない部分（<html> の属性・head・<script>）の指紋。
 * 表示中の HTML と取得した HTML で一致していれば差分適用してよい。
 *
 * 実行時に差し込まれる要素（解析タグ・同意バナー等）の影響を受けないよう、
 * ライブ DOM ではなくサーバー生成の HTML から算出する。
 */
export function computeMorphSignature(html) {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? ''
  const scripts = html.match(/<script\b[\s\S]*?<\/script>/gi)?.join('') ?? ''
  return createHash('md5').update(`${htmlTag}\u0000${head}\u0000${scripts}`).digest('hex')
}

/**
 * 注入するクライアントスクリプト。実ファイルを読むだけで、組み立ては行わない。
 * 設定はタグの data 属性で渡す（client/live-reload.js を参照）。
 */
let clientSource
function loadClientSource() {
  if (clientSource === undefined) {
    clientSource = readFileSync(new URL('../../client/live-reload.js', import.meta.url), 'utf8')
  }
  return clientSource
}

/**
 * 注入するスクリプトタグ。
 *
 * 指紋を属性として持たせ、タブ自身が「今表示している HTML の指紋」を覚えられるようにする。
 * サーバーは直近の指紋を覚えないので、同じページを何タブ開いても判定が狂わない。
 *
 * - domDiff: Pug の変更を location.reload() ではなく DOM の差分適用で反映する。
 *   スクロール位置・フォーム入力・遅延読み込み済み画像が保持される。
 *   idiomorph を読めないときは同梱せず、クライアントはフルリロードに退避する。
 * - scroll: エラーページでは無効にする。保存済みの位置を消費せず温存し、
 *   エラーページ自身の位置（≒先頭）も保存しないことで、修正後のリロードで
 *   エラー前の位置に戻れるようにする。
 */
export function createReloadTag({ signature = '', scroll = true, domDiff = true } = {}) {
  const idiomorph = domDiff ? loadIdiomorphSource() : null
  const attrs = [
    RELOAD_ATTR,
    `data-sse="${SSE_PATH}"`,
    ...(signature ? [`${SIGNATURE_ATTR}="${signature}"`] : []),
    ...(scroll ? [] : ['data-scroll="0"']),
    ...(idiomorph ? [] : ['data-dom-diff="0"'])
  ].join(' ')

  return `<script ${attrs}>\n${idiomorph ?? ''}\n${loadClientSource()}</script>`
}

