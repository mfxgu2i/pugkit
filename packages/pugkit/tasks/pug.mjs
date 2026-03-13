import { glob } from 'glob'
import { basename } from 'node:path'
import { compilePugFile } from '../transform/pug.mjs'
import { formatHtml } from '../transform/html.mjs'
import { createBuilderVars } from '../transform/builder-vars.mjs'
import { createImageSizeHelper, createImageInfoHelper } from '../transform/image-size.mjs'
import { generatePage } from '../generate/page.mjs'
import { logger } from '../utils/logger.mjs'

export async function pugTask(context, options = {}) {
  const { paths, cache, isProduction } = context
  const { files: targetFiles } = options

  const filesToBuild = await resolveFiles(paths, targetFiles)
  if (filesToBuild.length === 0) {
    logger.skip('pug', 'No files to build')
    return
  }

  const changed = await resolveChangedFiles(filesToBuild, targetFiles, cache, isProduction)
  if (changed.length === 0) {
    logger.skip('pug', 'No changes detected')
    return
  }

  logger.info('pug', `Building ${changed.length} file(s)`)
  await runWithConcurrency(changed, 8, file => processFile(file, context))
  logger.success('pug', `Built ${changed.length} file(s)`)
}

async function resolveFiles(paths, targetFiles) {
  if (targetFiles?.length > 0) {
    return targetFiles.filter(file => !basename(file).startsWith('_'))
  }

  const allFiles = await glob('**/*.pug', {
    cwd: paths.src,
    absolute: true,
    ignore: ['**/_*/**', '**/_*.pug']
  })

  return allFiles.filter(file => !basename(file).startsWith('_'))
}

async function resolveChangedFiles(files, targetFiles, cache, isProduction) {
  if (targetFiles?.length > 0) return files
  if (!isProduction) return cache.getChangedFiles(files)
  return files
}

async function runWithConcurrency(items, concurrency, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      await fn(items[i++])
    }
  })
  await Promise.all(workers)
}

async function processFile(filePath, context) {
  const { paths, config, cache, graph, imageGraph } = context

  try {
    let template = cache.getPugTemplate(filePath)

    if (!template) {
      const result = await compilePugFile(filePath, { basedir: paths.src })

      graph.clearDependencies(filePath)
      result.dependencies.forEach(dep => graph.addDependency(filePath, dep))

      template = result.template
      cache.setPugTemplate(filePath, template)
    }

    const builderVars = createBuilderVars(filePath, paths, config)

    // dev 時のみ: imageGraph に Pug->画像 の依存を記録して画像変更時の最小再ビルドに使う
    const accessedImages = new Set()
    const onAccess = context.isDevelopment ? imgPath => accessedImages.add(imgPath) : undefined
    const imageSize = createImageSizeHelper(filePath, paths, logger, { onAccess })
    const imageInfo = createImageInfoHelper(filePath, paths, logger, config, { onAccess })

    const html = template({ Builder: builderVars, imageSize, imageInfo })

    if (context.isDevelopment && imageGraph) {
      imageGraph.clearDependencies(filePath)
      accessedImages.forEach(imgPath => imageGraph.addDependency(filePath, imgPath))
    }

    const formatted = formatHtml(html, config.build.html)
    await generatePage(filePath, formatted, paths)
  } catch (error) {
    logger.error('pug', `Failed: ${basename(filePath)} - ${error.message}`)
    throw error
  }
}

export default pugTask
