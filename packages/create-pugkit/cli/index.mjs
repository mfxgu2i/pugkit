#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import pc from 'picocolors'
import { cac } from 'cac'
import prompts from 'prompts'
import degit from 'degit'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO = 'mfxgu2i/pugkit/packages/create-pugkit/template'
const SKILL_SOURCE = 'mfxgu2i/pugkit/skills'

// 選べるスキル。pugkit はビルド仕様、pugkit-house はその上に載る設計の型。
// テンプレートは pugkit-house の型に沿っていないので、既定では pugkit だけを入れる
const AVAILABLE_SKILLS = [
  { name: 'pugkit', description: 'ビルド仕様とAPI', selected: true },
  { name: 'pugkit-house', description: '設計と実装の型（FLOCSS・トークン・mixin）', selected: false }
]

// スキルの実体はリポジトリの skills/ だけに置き、ここへ配る。
// エージェントごとに探す場所が違うので、対応するディレクトリすべてに同じものを置く
const SKILL_ROOTS = [
  path.join('.claude', 'skills'), // Claude Code
  path.join('.github', 'skills') // GitHub Copilot
]

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

/**
 * 入れるスキルを決める。--skills があれば対話しない。
 *
 * 未知の名前は落として続ける。打ち間違いでスキャフォールドごと失敗させない
 */
async function resolveSkills(options) {
  const names = AVAILABLE_SKILLS.map(skill => skill.name)

  if (options.skills) {
    const requested = String(options.skills)
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)

    const unknown = requested.filter(name => !names.includes(name))
    if (unknown.length > 0) log(pc.yellow(`unknown skill: ${unknown.join(', ')}`))

    return requested.filter(name => names.includes(name))
  }

  // 対話できない環境（CI・パイプ経由）では聞かずに既定で進む。
  // ここで止めると npm create が何も作らずに終わる
  if (!process.stdin.isTTY) return AVAILABLE_SKILLS.filter(skill => skill.selected).map(skill => skill.name)

  const { skills } = await prompts({
    type: 'multiselect',
    name: 'skills',
    message: 'Add agent skills?',
    instructions: false,
    hint: '- space to toggle, enter to confirm',
    choices: AVAILABLE_SKILLS.map(skill => ({
      title: `${skill.name} - ${skill.description}`,
      value: skill.name,
      selected: skill.selected
    }))
  })

  // 中断（Ctrl+C）は undefined、すべて外した場合は空配列。前者だけ止める
  if (!skills) process.exit(1)

  return skills
}

async function copySkills(cwd, names) {
  if (names.length === 0) return

  log('adding agent skills...')

  for (const name of names) {
    await copySkill(cwd, name)
  }
}

/**
 * Agent Skill を1つ取得して、対応するエージェントのディレクトリすべてに置く。
 *
 * スキルはプロジェクトの必須物ではないので、取得に失敗してもスキャフォールドは続ける。
 * ここで止めると、ネットワークの一時的な不調でプロジェクト作成そのものが失敗する。
 * 1つ失敗しても残りは配る。片方だけでも成立するため
 */
async function copySkill(cwd, name) {
  const [primaryRoot, ...restRoots] = SKILL_ROOTS
  const primary = path.join(primaryRoot, name)
  const primaryPath = path.join(cwd, primary)

  try {
    const emitter = degit(`${SKILL_SOURCE}/${name}`, { cache: false, force: true, verbose: false })
    await emitter.clone(primaryPath)

    // degit は取得元が空でも例外を投げず、空のディレクトリだけが残る。
    // 中身の無いスキルを置いてもエージェントは読めないので、作った跡ごと消す
    if (!fs.existsSync(path.join(primaryPath, 'SKILL.md'))) {
      removeSkillDir(cwd, primary)
      log(pc.yellow(`skipped ${name} (not found)`))
      return
    }

    for (const root of restRoots) {
      const dest = path.join(cwd, root, name)
      mkdirp(path.dirname(dest))
      fs.cpSync(primaryPath, dest, { recursive: true })
    }
  } catch {
    removeSkillDir(cwd, primary)
    log(pc.yellow(`skipped ${name} (fetch failed)`))
  }
}

/** スキルの置き場と、そのために作られた空の親ディレクトリを消す */
function removeSkillDir(cwd, dir) {
  fs.rmSync(path.join(cwd, dir), { recursive: true, force: true })

  // .claude/skills → .claude の順に、空でなくなるまで遡って消す
  let parent = path.dirname(dir)
  while (parent !== '.') {
    const parentPath = path.join(cwd, parent)
    if (!fs.existsSync(parentPath) || fs.readdirSync(parentPath).length > 0) return
    fs.rmdirSync(parentPath)
    parent = path.dirname(parent)
  }
}

async function main(root, options) {
  const cwd = path.resolve(process.cwd(), root || '.')
  const current = !root || root === '.'
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

  // 書き込みを始める前に、必要な入力をすべて取る
  const skills = await resolveSkills(options)

  try {
    log('copying project files...')

    const emitter = degit(REPO, { cache: false, force: true, verbose: false })
    await emitter.clone(cwd)

    // Update package.json with project name
    const pkgPath = path.join(cwd, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      pkg.name = projectName
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    }

    await copySkills(cwd, skills)
  } catch (err) {
    console.error(`${pc.cyan(pc.bold('CREATE-PUGKIT'))} ${pc.dim(`v${pkgVersion()}`)} ${pc.red(err.message)}`)
    process.exit(1)
  }

  log('done!')
  console.log('\nNext steps:')

  let step = 1

  // dev は dist を見ないので、起動前のビルドは要らない
  console.log(`  ${step++}: ${pc.bold(pc.cyan('mise install'))}`)
  console.log(`  ${step++}: ${pc.bold(pc.cyan('npm install'))}`)
  console.log(`  ${step++}: ${pc.bold(pc.cyan('npm run start'))}`)
  console.log(`\nTo close the dev server, hit ${pc.bold(pc.cyan('Ctrl + C'))}`)
}

const cli = cac('create-pugkit')

cli
  .command('[root]', 'Scaffolding for pugkit projects')
  .option('--skills <skills>', 'Agent skills to add, comma separated (pugkit, pugkit-house)')
  .action(async (root, options) => {
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
