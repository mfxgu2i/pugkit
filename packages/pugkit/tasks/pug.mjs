import { glob } from 'glob'
import { basename, relative } from 'node:path'
import { compilePugFile } from '../transform/pug.mjs'
import { formatHtml } from '../transform/html.mjs'
import { createBuilderVars } from '../transform/builder-vars.mjs'
import { createImageInfoHelper } from '../transform/image-size.mjs'
import { generatePage } from '../generate/page.mjs'
import { logger } from '../utils/logger.mjs'
import { FILE_CONCURRENCY, runWithConcurrency } from '../utils/concurrency.mjs'

export async function pugTask(context) {
  const { paths } = context

  const filesToBuild = await resolveFiles(paths)
  if (filesToBuild.length === 0) {
    logger.skip('pug', 'No files to build')
    return
  }

  logger.info('pug', `Building ${filesToBuild.length} file(s)`)
  await runWithConcurrency(filesToBuild, FILE_CONCURRENCY, file => processFile(file, context))
  logger.success('pug', `Built ${filesToBuild.length} file(s)`)
}

async function resolveFiles(paths) {
  return glob('**/*.pug', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*/**', '**/_*.pug']
  })
}

/**
 * 1ページ分のHTMLを生成して返す（ファイル書き込みはしない）
 * dev の遅延ビルド（リクエスト時ビルド）と production の processFile が共用する。
 */
export async function buildPageHtml(filePath, context) {
  const { paths, config, cache, graph, imageGraph } = context

  // ビルド開始時の世代。ビルド中に watcher の無効化が入った場合、
  // 古いソースから作られた結果をキャッシュ・グラフに書き戻さないためのガード
  const epoch = context.isDevelopment ? cache.getPageEpoch(filePath) : undefined
  const isFresh = () => epoch === undefined || epoch === cache.getPageEpoch(filePath)

  try {
    let template = cache.getPugTemplate(filePath)

    if (!template) {
      const result = await compilePugFile(filePath, { basedir: paths.src })

      if (isFresh()) {
        graph.clearDependencies(filePath)
        result.dependencies.forEach(dep => graph.addDependency(filePath, dep))
        cache.setPugTemplate(filePath, result.template, epoch)
      }

      template = result.template
    }

    const builderVars = createBuilderVars(filePath, paths, config, {
      onMissingSiteUrl: () =>
        context.warnOnce(
          'config',
          'missing-site-url',
          `siteUrl が空のまま Builder.url を参照しています: ${relative(paths.src, filePath)}。OGP や canonical に相対パスが入ります。pugkit.config.mjs の siteUrl か、build の --site-url で指定してください`
        )
    })

    // dev 時のみ: imageGraph に Pug->画像 の依存を記録して画像変更時の最小再ビルドに使う
    const accessedImages = new Set()
    const onAccess = context.isDevelopment ? imgPath => accessedImages.add(imgPath) : undefined
    const imageInfo = createImageInfoHelper(filePath, context, { onAccess })

    const html = template({ Builder: builderVars, imageInfo })

    if (context.isDevelopment && imageGraph && isFresh()) {
      imageGraph.clearDependencies(filePath)
      accessedImages.forEach(imgPath => imageGraph.addDependency(filePath, imgPath))
    }

    return formatHtml(html, config.build.html)
  } catch (error) {
    logger.error('pug', `Failed: ${basename(filePath)} - ${error.message}`)
    throw error
  }
}

async function processFile(filePath, context) {
  const formatted = await buildPageHtml(filePath, context)

  try {
    await generatePage(filePath, formatted, context.paths)
  } catch (error) {
    logger.error('pug', `Failed: ${basename(filePath)} - ${error.message}`)
    throw error
  }
}

export default pugTask
