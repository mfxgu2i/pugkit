#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { cac } from 'cac'
import { develop } from './develop.mjs'
import { build } from './build.mjs'
import { sprite } from './sprite.mjs'
import { unsupportedNodeMessage } from '../utils/node-version.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function pkgVersion() {
  const pkgPath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

/**
 * 異常終了。3 つのコマンドで表示を揃える。
 *
 * 利用者に見せるのはメッセージだけにする。設定ミスや出力先の衝突のように
 * 「ソースを直せば済む」エラーが、スタックトレースに埋もれると読まれない。
 * スタックは pugkit 自身の不具合を追うときだけ必要なので PUGKIT_DEBUG=1 で出す
 */
function fail(error) {
  console.error(process.env.PUGKIT_DEBUG ? (error.stack ?? error) : (error.message ?? error))
  process.exit(1)
}

// 引数を解釈する前に判定する。古い Node では依存の読み込みで落ちることがあり、
// そうなると原因が pugkit の不具合に見える
const unsupportedNode = unsupportedNodeMessage(process.versions.node)
if (unsupportedNode) fail(new Error(unsupportedNode))

const cli = cac('pugkit')

cli
  .command('[root]', 'Start development mode with file watching')
  .alias('dev')
  .alias('watch')
  .option('--port <port>', 'Override server.port in config')
  .option('--host <host>', 'Override server.host in config')
  .action(async (root, options) => {
    try {
      let port
      if (options.port !== undefined) {
        port = Number(options.port)
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new Error(`--port には 0〜65535 の整数を指定してください: ${options.port}`)
        }
      }
      await develop({ root: root || process.cwd(), port, host: options.host })
    } catch (err) {
      fail(err)
    }
  })

cli
  .command('build [root]', 'Production build')
  .option('--site-url <url>', 'Override siteUrl in config')
  .action(async (root, options) => {
    try {
      await build({ root: root || process.cwd(), siteUrl: options.siteUrl })
    } catch (err) {
      fail(err)
    }
  })

cli.command('sprite [root]', 'Generate SVG sprite').action(async root => {
  try {
    await sprite({ root: root || process.cwd() })
  } catch (err) {
    fail(err)
  }
})

cli.help()
cli.version(pkgVersion())
cli.parse()
