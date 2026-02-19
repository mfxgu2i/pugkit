import { relative } from 'node:path'

export function createBuilderVars(filePath, paths, config) {
  const relativePath = relative(paths.src, filePath)
  const normalizedPath = relativePath.replace(/\\/g, '/')
  const depth = normalizedPath.split('/').length - 1
  const autoDir = depth === 0 ? './' : '../'.repeat(depth)

  let autoPageUrl = normalizedPath

  if (autoPageUrl.endsWith('index.pug')) {
    autoPageUrl = autoPageUrl.replace(/index\.pug$/, '')
  } else {
    autoPageUrl = autoPageUrl.replace(/\.pug$/, '.html')
  }

  const siteUrl = config.siteUrl || ''
  const subdir = config.subdir ? '/' + config.subdir.replace(/^\/|\/$/g, '') : ''
  const origin = siteUrl.replace(/\/$/, '')
  const base = origin + subdir
  const pathname = autoPageUrl ? (autoPageUrl.startsWith('/') ? autoPageUrl : '/' + autoPageUrl) : '/'
  const href = base + pathname

  return {
    dir: autoDir,
    subdir,
    url: {
      origin,
      base,
      pathname,
      href
    }
  }
}
