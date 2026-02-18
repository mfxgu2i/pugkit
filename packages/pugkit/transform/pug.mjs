import { readFile } from 'node:fs/promises'
import pug from 'pug'

export function compilePug(content, options) {
  const { filename, basedir } = options

  const result = pug.compileClientWithDependenciesTracked(content, {
    filename,
    basedir,
    compileDebug: false,
    inlineRuntimeFunctions: true
  })

  // eslint-disable-next-line no-new-func
  const template = new Function('locals', result.body + '; return template(locals);')

  return {
    template,
    dependencies: result.dependencies || []
  }
}

export async function compilePugFile(filePath, options) {
  const content = await readFile(filePath, 'utf8')
  return compilePug(content, { filename: filePath, ...options })
}
