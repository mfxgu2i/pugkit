import { buildPageHtml } from '../../tasks/pug.mjs'

/**
 * リクエスト時遅延ビルダーを生成する。
 * - 同一ページへの同時リクエストは 1 ビルドに統合（in-flight 重複排除）
 * - in-flight エントリはビルド開始時の世代付き。無効化後は古い in-flight に相乗りしない
 * - ビルド失敗時はエントリを必ず破棄（エラーはキャッシュしない）
 */
export function createLazyPageBuilder(context, buildFn = buildPageHtml) {
  const inflight = new Map() // pugFile -> { epoch, promise }

  return function getPage(pugFile) {
    const { cache } = context

    const cached = cache.getPageHtml(pugFile)
    if (cached !== undefined) return Promise.resolve(cached)

    const epoch = cache.getPageEpoch(pugFile)
    const entry = inflight.get(pugFile)
    if (entry && entry.epoch === epoch) return entry.promise

    const promise = buildFn(pugFile, context)
      .then(html => {
        cache.setPageHtml(pugFile, html, epoch)
        return html
      })
      .finally(() => {
        if (inflight.get(pugFile)?.promise === promise) inflight.delete(pugFile)
      })

    inflight.set(pugFile, { epoch, promise })
    return promise
  }
}
