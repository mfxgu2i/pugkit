import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function develop(options = {}) {
  const { root = process.cwd(), port, host, open, outDir } = options

  logger.info('pugkit', 'starting dev server...')

  const builder = await createBuilder(root, 'development', { outDir })

  if (port) builder.context.config.server.port = port
  if (host) builder.context.config.server.host = host
  if (open) builder.context.config.server.open = open

  await builder.watch()
}
