import { glob } from 'glob'
import { copyFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'
import { FILE_CONCURRENCY, runWithConcurrency } from '../utils/concurrency.mjs'
import { overriddenPugFor } from '../utils/page-conflict.mjs'

/**
 * public のファイルの出力先。生成側と watcher の削除側で規則がずれると、
 * 消したはずのファイルが配信され続けるので、ここ一箇所に置く。
 *
 * @param relativePath public からの相対パス
 */
export function publicOutputPath(relativePath, paths) {
  return resolve(paths.output, relativePath)
}

/**
 * copy は pug のあとに走るので、同名の HTML があれば Pug の出力を上書きする。
 * 黙って消えると「書いたはずのページが本番に出ない」ことに気づけないため知らせる。
 */
function warnPageConflicts(files, paths) {
  for (const file of files) {
    const pugFile = overriddenPugFor(file, paths)
    if (!pugFile) continue

    logger.warn(
      'copy',
      `public/${relative(paths.public, file)} が src/${relative(paths.src, pugFile)} の出力を上書きします`
    )
  }
}

async function copyOne(file, paths) {
  const outputPath = publicOutputPath(relative(paths.public, file), paths)
  await ensureFileDir(outputPath)
  await copyFile(file, outputPath)
}

/**
 * ファイルコピータスク
 */
export async function copyTask(context, options = {}) {
  const { paths } = context

  // 変更されたファイルだけ（dev の監視時）
  if (options.changed) {
    warnPageConflicts([options.changed], paths)
    await copyOne(options.changed, paths)
    logger.success('copy', `Copied ${relative(paths.public, options.changed)}`)
    return
  }

  const files = await glob('**/*', {
    cwd: paths.public,
    absolute: true,
    nodir: true,
    dot: true
  })

  if (files.length === 0) {
    logger.skip('copy', 'No files to copy')
    return
  }

  logger.info('copy', `Copying ${files.length} file(s)`)
  warnPageConflicts(files, paths)

  await runWithConcurrency(files, FILE_CONCURRENCY, file => copyOne(file, paths))

  logger.success('copy', `Copied ${files.length} file(s)`)
}

export default copyTask
