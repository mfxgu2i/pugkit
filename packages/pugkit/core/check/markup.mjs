import { glob } from 'glob'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FILE_CONCURRENCY, runWithConcurrency } from '../../utils/concurrency.mjs'

/**
 * markuplint に出力 HTML を渡して妥当性を見る。
 *
 * markuplint は pugkit の依存に含めない（optional peer）。利用者のプロジェクトに
 * あるものをそのまま使い、設定も markuplint.config.js を唯一の真実とする。
 * 理由は [ADR 0011](../../../../docs/adr/0011-check-is-a-separate-command.md) にある。
 *
 * 渡すのはソースの .pug ではなく出力の .html。markuplint の Pug 対応は
 * コンポーネントをまたぐ構造を追い切れないため。
 */

/** markuplint が受け付ける設定ファイル名。探索はプロジェクトルートだけを見る */
const CONFIG_FILES = [
  '.markuplintrc',
  '.markuplintrc.json',
  '.markuplintrc.yaml',
  '.markuplintrc.yml',
  '.markuplintrc.js',
  '.markuplintrc.cjs',
  '.markuplintrc.mjs',
  '.markuplintrc.ts',
  'markuplint.config.js',
  'markuplint.config.cjs',
  'markuplint.config.mjs',
  'markuplint.config.ts'
]

async function hasConfig(root) {
  if (CONFIG_FILES.some(name => existsSync(resolve(root, name)))) return true

  try {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
    return Boolean(pkg.markuplint)
  } catch {
    return false
  }
}

/**
 * markuplint を読み込む。入っていなければ null。
 *
 * peerDependencies に宣言してあるので、pnpm や Yarn PnP でも利用者のプロジェクトの
 * ものが解決される。入っていないこと自体は違反ではないので例外にしない。
 *
 * 「見つからない」以外の失敗は投げる。プラグインの読み込み失敗を「入っていません」に
 * 丸めると、案内どおり入れ直しても直らないうえ、検査していないことが成功扱いで通る
 */
async function loadMarkuplint() {
  try {
    return await import('markuplint')
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null
    throw error
  }
}

const toPosix = p => p.replace(/\\/g, '/')

/**
 * 1 ファイル分を検査する。
 *
 * パスをそのまま渡さず中身を読んで渡すのは、markuplint がパスを glob として扱うため。
 * `[案件名]` のような角括弧を含むディレクトリや、Windows の区切り文字で
 * 1 件も一致しなくなり、検査が例外で落ちる
 */
async function execFile(markuplint, absolute) {
  const sourceCode = await readFile(absolute, 'utf8')
  const file = await markuplint.MLEngine.toMLFile({ sourceCode, name: absolute })
  if (!file) return []

  const engine = new markuplint.MLEngine(file)

  try {
    const result = await engine.exec()
    return result?.violations ?? []
  } finally {
    // MLEngine は watch でなくても FSWatcher を抱える
    await engine.close?.()
  }
}

/**
 * @param load 差し替え可能。markuplint が入っていない環境の挙動を、
 *   入っている環境のテストから確かめるために開けてある
 */
export async function checkMarkup(context, { load = loadMarkuplint } = {}) {
  const { paths } = context
  const notices = []

  const markuplint = await load()

  if (!markuplint) {
    notices.push('markuplint が入っていないため markup は検査していません。npm i -D markuplint で入ります')
    return { findings: [], notices }
  }

  // 拡張子はパターンに書かず自分で判定する（references.mjs と同じ理由）
  const files = (await glob('**/*', { cwd: paths.outputRoot, nodir: true }))
    .map(toPosix)
    .filter(file => /\.html$/i.test(file))
    .sort()

  if (files.length === 0) {
    notices.push('出力に .html がありません。markup は検査していません')
    return { findings: [], notices }
  }

  if (!(await hasConfig(paths.root))) {
    notices.push('markuplint の設定が見つからないため、markuplint の既定ルールで検査しました')
  }

  const findings = []

  await runWithConcurrency(files, FILE_CONCURRENCY, async relativePath => {
    const absolute = resolve(paths.outputRoot, relativePath)

    for (const violation of await execFile(markuplint, absolute)) {
      findings.push({
        file: relativePath,
        line: violation.line,
        column: violation.col,
        rule: violation.ruleId,
        severity: violation.severity,
        message: violation.message
      })
    }
  })

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)

  return { findings, notices }
}
