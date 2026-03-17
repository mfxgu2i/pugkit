#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { cac } from 'cac'
import { develop } from './develop.mjs'
import { build } from './build.mjs'
import { sprite } from './sprite.mjs'
import { benchImage } from './bench.mjs'

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

cli
  .command('build [root]', 'Production build')
  .option('--site-url <url>', 'Override siteUrl in config')
  .action(async (root, options) => {
    try {
      await build({ root: root || process.cwd(), siteUrl: options.siteUrl })
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

cli.command('bench [target]', 'Benchmark images in src/ against pugkit.config.mjs').action(async target => {
  try {
    await benchImage({ root: process.cwd(), target })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})

cli.help()
cli.version(pkgVersion())
cli.parse()
