#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { cac } from 'cac'
import { develop } from './develop.mjs'
import { build } from './build.mjs'
import { sprite } from './sprite.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function pkgVersion() {
  const pkgPath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

const cli = cac('pugkit')

cli
  .command('[root]', 'Start development mode with file watching')
  .alias('dev')
  .alias('watch')
  .action(async (root, options) => {
    try {
      await develop({ root: root || process.cwd() })
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

cli.command('build [root]', 'Production build').action(async root => {
  try {
    await build({ root: root || process.cwd() })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})

cli.command('sprite [root]', 'Generate SVG sprite').action(async root => {
  try {
    await sprite({ root: root || process.cwd() })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})

cli.help()
cli.version(pkgVersion())
cli.parse()
