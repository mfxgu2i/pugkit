import { glob } from 'glob'
import { basename } from 'node:path'
import { compilePugFile } from '../transform/pug.mjs'
import { formatHtml } from '../transform/html.mjs'
import { createBuilderVars } from '../transform/builder-vars.mjs'
import { createImageSizeHelper } from '../transform/image-size.mjs'
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
  await Promise.all(changed.map(file => processFile(file, context)))
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

async function processFile(filePath, context) {
  const { paths, config, cache, graph } = context

  try {
    let template = cache.getPugTemplate(filePath)

    if (!template) {
      const result = await compilePugFile(filePath, { basedir: paths.src })

      if (result.dependencies.length > 0) {
        graph.clearDependencies(filePath)
        result.dependencies.forEach(dep => graph.addDependency(filePath, dep))
      }

      template = result.template
      cache.setPugTemplate(filePath, template)
    }

    const builderVars = createBuilderVars(filePath, paths, config)
    const imageSize = createImageSizeHelper(filePath, paths, logger)

    const html = template({ Builder: builderVars, imageSize })
    const formatted = await formatHtml(html)
    await generatePage(filePath, formatted, paths)
  } catch (error) {
    logger.error('pug', `Failed: ${basename(filePath)} - ${error.message}`)
    throw error
  }
}

export default pugTask
