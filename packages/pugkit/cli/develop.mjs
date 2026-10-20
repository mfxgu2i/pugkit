import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

// Windows には SIGTERM が来ず、ウィンドウを閉じると SIGHUP、Ctrl+Break で SIGBREAK が来る。
// POSIX で SIGHUP を受けると、nohup で切り離した dev サーバーが端末を閉じたときに止まる
const SHUTDOWN_SIGNALS = process.platform === 'win32' ? ['SIGINT', 'SIGHUP', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']

export async function develop(options = {}) {
  const { port, host } = options

  logger.info('pugkit', 'starting dev server...')

  const builder = await createBuilder(process.cwd(), 'development', { port, host })

  // Ctrl+C でも公開 API と同じ経路で後始末する。
  // ここを通さないと close() が本番で一度も実行されず、正しさがテストの中だけになる
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      builder.close().finally(() => process.exit(0))
    })
  }

  await builder.watch()
}
