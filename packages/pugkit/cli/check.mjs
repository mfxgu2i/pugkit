import pc from 'picocolors'
import { check as runCheck } from '../index.mjs'
import { logger } from './logger.mjs'

/**
 * 検査結果の表示と終了コードの決定。
 *
 * 見出し行のロガーを1件ずつ呼ばないのは、名前とバージョンが行頭に並ぶと
 * 件数が増えたときに読めなくなるため。ファイル単位でまとめ、行と列を先頭に置く。
 * references と markup を別の塊にしないのは、直す人がファイルを開いて直すので、
 * 道具ごとに分かれていると同じファイルを2回開くことになるから。
 *
 * 打ち切りは入れない。上限を設けると、上限に達したこと自体が見落とされる。
 */

/** 桁を揃えるための幅。ファイルごとに求める */
function pad(value, width) {
  return String(value).padEnd(width)
}

/**
 * 重さの判定は markuplint の設定に任せ、表示だけ分ける。
 *
 * 終了コードは重さで変えない。「報告があれば 1」で説明が済むほうを取り、
 * 何を warning に落とすかは markuplint の設定に一本化する
 */
function severityColor(finding) {
  if (finding.severity === 'warning') return pc.yellow
  if (finding.severity === 'info') return pc.cyan
  return pc.red
}

function groupByFile(findings) {
  const groups = new Map()

  for (const finding of findings) {
    const list = groups.get(finding.file)
    if (list) list.push(finding)
    else groups.set(finding.file, [finding])
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.line - b.line || a.column - b.column)
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function report(findings) {
  for (const [file, list] of groupByFile(findings)) {
    console.log(`\n${pc.underline(file)}`)

    const positionWidth = Math.max(...list.map(f => `${f.line}:${f.column}`.length))
    const ruleWidth = Math.max(...list.map(f => String(f.rule).length))

    for (const finding of list) {
      const position = pad(`${finding.line}:${finding.column}`, positionWidth)
      const rule = pad(finding.rule, ruleWidth)
      console.log(`  ${pc.dim(position)}  ${severityColor(finding)(rule)}  ${finding.message}`)
    }
  }
}

/**
 * @param items 検査項目の id。空なら全部
 * @returns 違反があれば true。呼び出し側が終了コードを決める
 */
export async function check(items = []) {
  logger.info('pugkit', 'checking...')

  const { findings, notices } = await runCheck(process.cwd(), items)

  for (const notice of notices) logger.warn('pugkit', notice)

  if (findings.length === 0) {
    logger.success('pugkit', 'no problems found')
    return false
  }

  report(findings)

  const files = new Set(findings.map(finding => finding.file)).size
  console.log('')
  logger.error('pugkit', `${files} ファイル ${findings.length} 件`)

  return true
}
