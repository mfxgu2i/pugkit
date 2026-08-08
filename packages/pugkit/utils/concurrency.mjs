/**
 * 同時実行数を抑えて順に処理する。
 *
 * Promise.all で全件を一度に開くと、点数の多い案件でファイルディスクリプタと
 * メモリを一気に使い切る（画像は 1 枚ごとに sharp のパイプラインを持つため特に効く）。
 * 上限つきで流せば、所要時間はほぼ変わらないまま使用量が頭打ちになる。
 *
 * 例外は最初の1つを投げる（Promise.all と同じ）。残りのワーカーは走り切る。
 */
export async function runWithConcurrency(items, limit, fn) {
  let index = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      await fn(items[index++])
    }
  })

  await Promise.all(workers)
}

/**
 * ファイル単位のタスクの既定の同時実行数。
 * 揃えておかないと、タスクごとに負荷の出方が変わって原因を追いにくくなる
 */
export const FILE_CONCURRENCY = 8
