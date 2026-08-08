import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function develop(options = {}) {
  const { root = process.cwd(), port, host } = options

  logger.info('pugkit', 'starting dev server...')

  const builder = await createBuilder(root, 'development')

  if (port) builder.context.config.server.port = port
  if (host) builder.context.config.server.host = host

  // Ctrl+C でも公開 API と同じ経路で後始末する。
  // ここを通さないと close() が本番で一度も実行されず、正しさがテストの中だけになる
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      builder.close().finally(() => process.exit(0))
    })
  }

  await builder.watch()
}
