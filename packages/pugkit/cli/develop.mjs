import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function develop(options = {}) {
  const { port, host } = options

  logger.info('pugkit', 'starting dev server...')

  const builder = await createBuilder(process.cwd(), 'development', { port, host })

  // Ctrl+C でも公開 API と同じ経路で後始末する。
  // ここを通さないと close() が本番で一度も実行されず、正しさがテストの中だけになる
  // Windows には SIGTERM が来ない。ウィンドウを閉じると SIGHUP、Ctrl+Break は SIGBREAK になる。
  // POSIX で SIGHUP を握ると、nohup で端末から切り離した dev サーバーが端末を閉じたときに止まる
  const signals = process.platform === 'win32' ? ['SIGINT', 'SIGHUP', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']
  for (const signal of signals) {
    process.once(signal, () => {
      builder.close().finally(() => process.exit(0))
    })
  }

  await builder.watch()
}
