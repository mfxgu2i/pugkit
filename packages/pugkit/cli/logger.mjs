import pc from 'picocolors'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const version = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version

export const logger = {
  info(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${version}`)} ${message}`)
  },

  success(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${version}`)} ${message}`)
  },

  warn(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${version}`)} ${message}`)
  },

  error(name, message) {
    console.error(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${version}`)} ${message}`)
  }
}
