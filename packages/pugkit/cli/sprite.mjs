import { createBuilder } from '../index.mjs'
import { logger } from './logger.mjs'

export async function sprite() {
  logger.info('pugkit', 'generating sprite...')

  const builder = await createBuilder(process.cwd(), 'production')
  await builder.runTask('sprite')

  logger.success('pugkit', 'sprite generated')
}
