import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function build(options = {}) {
  const { root = process.cwd() } = options

  logger.info('pugkit', 'building...')

  const startTime = Date.now()
  const builder = await createBuilder(root, 'production')
  await builder.build()

  const elapsed = Date.now() - startTime
  logger.success('pugkit', `built in ${elapsed}ms`)
}
