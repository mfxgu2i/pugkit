#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { cac } from 'cac'
import { develop } from './develop.mjs'
import { build } from './build.mjs'
import { sprite } from './sprite.mjs'
import { check } from './check.mjs'
import { CHECK_IDS } from '../core/check/index.mjs'
import { unsupportedNodeMessage } from '../utils/node-version.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function pkgVersion() {
  const pkgPath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

/**
 * 異常終了。4 つのコマンドで表示を揃える。
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

// どのコマンドもプロジェクトルートを引数に取らず、cwd を見る。
// check が項目名を可変長引数で受けるため、先頭の位置引数をルートに使えない。
// 3 コマンドだけ形が違うと「書けるはずの引数が check にだけ無い」と読めるので揃える
cli
  .command('', 'Start development mode with file watching')
  .alias('dev')
  .alias('watch')
  .option('--port <port>', 'Override server.port in config')
  .option('--host <host>', 'Override server.host in config')
  .action(async options => {
    try {
      let port
      if (options.port !== undefined) {
        port = Number(options.port)
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new Error(`--port には 0〜65535 の整数を指定してください: ${options.port}`)
        }
      }
      await develop({ port, host: options.host })
    } catch (err) {
      fail(err)
    }
  })

cli
  .command('build', 'Production build')
  .option('--site-url <url>', 'Override siteUrl in config')
  .action(async options => {
    try {
      await build({ siteUrl: options.siteUrl })
    } catch (err) {
      fail(err)
    }
  })

cli.command('sprite', 'Generate SVG sprite').action(async () => {
  try {
    await sprite()
  } catch (err) {
    fail(err)
  }
})

cli.command('check [...items]', `Check the built output (${CHECK_IDS.join(' / ')})`).action(async items => {
  try {
    const failed = await check(items)
    if (failed) process.exit(1)
  } catch (err) {
    fail(err)
  }
})

// 位置引数を廃止したので、綴りを間違えたサブコマンドは既定コマンド（dev）に落ちる。
// `pugkit chekc` が黙って dev サーバーを起動するのは、静かに間違いが通る形になる
const KNOWN_COMMANDS = new Set(['dev', 'watch', 'build', 'sprite', 'check'])

// 判定は先頭の引数だけ。既定コマンドは位置引数を取らないので、
// 「-」で始まらない先頭の引数はコマンド名しかありえない
const [subcommand] = process.argv.slice(2)
if (subcommand && !subcommand.startsWith('-') && !KNOWN_COMMANDS.has(subcommand)) {
  fail(new Error(`知らないコマンドです: ${subcommand}\n利用できるコマンド: ${[...KNOWN_COMMANDS].join(' / ')}`))
}

cli.help()
cli.version(pkgVersion())
cli.parse()
