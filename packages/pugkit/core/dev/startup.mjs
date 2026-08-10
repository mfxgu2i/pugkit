import net from 'node:net'
import { logger } from '../../utils/logger.mjs'
import { resetDevCache } from '../../utils/file.mjs'
import { serverAddress } from '../../config/defaults.mjs'
import { assertUniqueOutputs } from '../output-conflicts.mjs'

// Pug（HTML）だけは遅延ビルド + メモリ配信なので事前生成しない。
// 他は実ファイルとして配信するため、出力先が空の状態でも表示できるよう起動時に作る
const INITIAL_DEV_TASKS = ['sass', 'script', 'image', 'svg', 'sprite', 'copy']

/**
 * dev セッションを始められる状態にする。
 *
 * 順序そのものが仕様なので、監視の結線（chokidar）とは分けてここにまとめる:
 *   1. ポートの空き確認 — 待ち受けに失敗するなら、キャッシュを作り直す前に知らせる
 *   2. dev キャッシュの作り直し — 前回セッションの残骸を配信しない
 *   3. 出力先の衝突検査 — 設定ミスの通知のみ（中止はしない）
 *   4. Pug 以外の初期ビルド — 空の出力先でも表示できるようにする
 *
 * 中止するのは 1 と 2 だけ。3 と 4 で止めると、dev キャッシュを作り直した直後に
 * 落ちるため「直そうとして起動しても起動しない」状態になる
 */
export async function prepareDevSession(context, runTask) {
  const { paths, config } = context
  const { port, host } = serverAddress(config)

  await assertPortAvailable(port, host)
  await prepareDevOutput(paths.outputRoot)
  await reportOutputConflicts(context)
  await runInitialTasks(runTask)
}

/**
 * ポートが使用可能か確認する。使用中なら起動を中止する。
 *
 * 別の dev サーバーからキャッシュを守るのはこの確認ではなく resetDevCache の役目
 * （ポートを変えれば2つ目が起動できてしまうため）
 */
export function assertPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once('error', error => {
        if (error.code === 'EADDRINUSE') {
          reject(
            new Error(`ポート ${port} は既に使用されています。別の dev サーバーが起動していないか確認してください`)
          )
          return
        }
        reject(error)
      })
      .once('listening', () => tester.close(() => resolve()))
      .listen(port, host)
  })
}

/**
 * dev の出力先はツール専用のキャッシュなので毎回作り直してよい。
 * 前回セッションの残骸（削除済みソースの生成物）が配信されるのを防ぎ、
 * 「dev で見えているもの = 現在の src」を保証する
 */
async function prepareDevOutput(outputRoot) {
  try {
    await resetDevCache(outputRoot)
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new Error(`dev の出力先 "${outputRoot}" に書き込めません。cacheDir に書き込み可能なパスを指定してください`)
    }
    throw error
  }
}

/**
 * 出力先の衝突は起動時に一度だけ見る。変更のたびに見ないのは、
 * 衝突が設定ミスであり、最終的な関門は build 側だから（dev は軽さを優先する）
 */
function reportOutputConflicts(context) {
  return assertUniqueOutputs(context).catch(error => logger.error('watch', error.message))
}

/**
 * Pug 以外を初期ビルドする。Pug（HTML）は遅延ビルド + メモリ配信なので事前生成が不要で、
 * 依存グラフもページが最初にリクエストされた時に構築される。
 *
 * 1つ壊れていても他のアセットと dev サーバーは動かす（起動後に同じファイルを
 * 壊したときと同じ扱いにする）
 */
function runInitialTasks(runTask) {
  return Promise.all(
    INITIAL_DEV_TASKS.map(name =>
      runTask(name).catch(error => logger.error('watch', `${name} の初期ビルドに失敗しました: ${error.message}`))
    )
  )
}
