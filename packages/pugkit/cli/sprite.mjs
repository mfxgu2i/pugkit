import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function sprite(options = {}) {
  const { root = process.cwd(), outDir } = options

  logger.info('pugkit', 'generating sprite...')

  const builder = await createBuilder(root, 'production', { outDir })
  await builder.runTask('sprite')

  logger.success('pugkit', 'sprite generated')
}
