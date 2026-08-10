import pc from 'picocolors'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const version = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version

/**
 * CLI の見出し行。コマンドの開始と終了を伝える。
 *
 * ビルド中の細かい進捗（utils/logger.mjs）とは別物で、こちらは名前とバージョンを
 * 添える。レベルごとに色を変えるのは、警告と失敗が通常の進捗に埋もれないため
 */
function write(stream, color, name, message) {
  stream(`${color(pc.bold(name.toUpperCase()))} ${pc.dim(`v${version}`)} ${message}`)
}

export const logger = {
  info(name, message) {
    write(console.log, pc.cyan, name, message)
  },

  success(name, message) {
    write(console.log, pc.green, name, message)
  },

  warn(name, message) {
    write(console.log, pc.yellow, name, message)
  },

  error(name, message) {
    write(console.error, pc.red, name, message)
  }
}
