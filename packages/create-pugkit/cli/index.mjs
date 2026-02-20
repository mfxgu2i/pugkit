#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs-extra'
import pc from 'picocolors'
import { cac } from 'cac'
import prompts from 'prompts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function pkgVersion() {
  const pkgPath = path.join(__dirname, '../package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return pkg.version
}

function log(message) {
  console.log(`${pc.cyan(pc.bold('CREATE-PUGKIT'))} ${pc.dim(`v${pkgVersion()}`)} ${message}`)
}

function mkdirp(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (err) {
    if (err.code === 'EEXIST') return
    throw err
  }
}

async function main(root, options) {
  const cwd = path.resolve(process.cwd(), root || '.')
  const current = root === '.'
  const projectName = current ? path.basename(process.cwd()) : root

  const questions = {
    overwrite: {
      type: 'confirm',
      name: 'overwrite',
      message: 'Directory not empty. Continue [force overwrite]?',
      initial: false
    }
  }

  if (fs.existsSync(cwd)) {
    if (fs.readdirSync(cwd).length > 0) {
      const { overwrite } = await prompts(questions.overwrite)
      if (!overwrite) {
        process.exit(1)
      }
      !current && mkdirp(cwd)
    }
  } else {
    !current && mkdirp(cwd)
  }

  try {
    log('copying project files...')

    // Copy template files from the package
    const templateDir = path.join(__dirname, '../template')
    await fs.copy(templateDir, cwd, {
      overwrite: true,
      filter: src => {
        // Skip node_modules and dist directories
        return !src.includes('node_modules') && !src.includes('dist')
      }
    })

    // Update package.json with project name
    const pkgPath = path.join(cwd, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = await fs.readJson(pkgPath)
      pkg.name = projectName
      await fs.writeJson(pkgPath, pkg, { spaces: 2 })
    }
  } catch (err) {
    console.error(`${pc.cyan(pc.bold('CREATE-PUGKIT'))} ${pc.dim(`v${pkgVersion()}`)} ${pc.red(err.message)}`)
    process.exit(1)
  }

  log('done!')
  console.log('\nNext steps:')

  let step = 1

  const relative = path.relative(process.cwd(), cwd)
  if (relative !== '') {
    console.log(`  ${step++}: ${pc.bold(pc.cyan(`cd ${relative}`))}`)
  }

  console.log(`  ${step++}: ${pc.bold(pc.cyan('npm install'))}`)
  console.log(`  ${step++}: ${pc.bold(pc.cyan('npm run build'))}`)
  console.log(`  ${step++}: ${pc.bold(pc.cyan('npm run dev'))}`)
  console.log(`\nTo close the dev server, hit ${pc.bold(pc.cyan('Ctrl + C'))}`)
}

const cli = cac('create-pugkit')

cli.command('[root]', 'Scaffolding for pugkit projects').action(async (root, options) => {
  try {
    await main(root, options)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})

cli.help()
cli.version(pkgVersion())
cli.parse()
