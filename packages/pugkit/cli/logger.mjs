import pc from 'picocolors'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getVersion() {
  const pkgPath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

export const logger = {
  info(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${getVersion()}`)} ${message}`)
  },

  success(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${getVersion()}`)} ${message}`)
  },

  warn(name, message) {
    console.log(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${getVersion()}`)} ${message}`)
  },

  error(name, message) {
    console.error(`${pc.cyan(pc.bold(name.toUpperCase()))} ${pc.dim(`v${getVersion()}`)} ${message}`)
  }
}
