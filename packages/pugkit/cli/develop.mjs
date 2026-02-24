import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function develop(options = {}) {
  const { root = process.cwd(), port, host } = options

  logger.info('pugkit', 'starting dev server...')

  const builder = await createBuilder(root, 'development')

  if (port) builder.context.config.server.port = port
  if (host) builder.context.config.server.host = host

  await builder.watch()
}
