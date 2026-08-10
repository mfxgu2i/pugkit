import { glob } from 'glob'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectHtmlReferences } from './html-references.mjs'
import { collectCssReferences } from './css-references.mjs'
import { referencePath, resolveReference } from './reference-url.mjs'
import { FILE_CONCURRENCY, runWithConcurrency } from '../../utils/concurrency.mjs'

/**
 * 出力に書かれた参照が実在するかを見る。
 *
 * リンク切れと画像切れは例外にならないまま納品される。ビルドは成功し、
 * HTML を1枚ずつ開くまで気づけない。とくに CSS の url() は、sass タスクが
 * 書き換えない方針なので「変換後の名前を直書きしないと壊れる」形で静かに壊れる。
 *
 * 見るのは dist に出た .html と .css。由来は区別しない。守りたいのは納品物としての
 * dist であって、public に手で置いた HTML のリンク切れも同じ壊れ方をする。
 */

const toPosix = p => p.replace(/\\/g, '/')

const RULE = 'missing-reference'

/**
 * 検査対象を集める。
 *
 * glob の大文字小文字の扱いはプラットフォームで変わる（macOS と Windows は区別しない）。
 * 拡張子をパターンに書くと、手元で拾えたファイルが Linux の CI で拾われない。
 * 全件を挙げてから自分で判定する
 */
async function listTargets(outputRoot) {
  const files = await glob('**/*', { cwd: outputRoot, nodir: true })

  return files
    .map(toPosix)
    .filter(file => /\.(html|css)$/i.test(file))
    .sort()
}

/**
 * 同じ参照は共通のレイアウトや CSS から何度も出てくる。
 * 解決結果を実行中だけ持ち、同じ URL に対する stat を繰り返さない
 */
function createResolver(outputRoot) {
  const cache = new Map()

  return urlPath => {
    if (cache.has(urlPath)) return cache.get(urlPath)

    const found = Boolean(resolveReference(urlPath, outputRoot))
    cache.set(urlPath, found)
    return found
  }
}

async function readTarget(absolute) {
  try {
    return { code: await readFile(absolute, 'utf8'), error: null }
  } catch (error) {
    // 壊れたシンボリックリンクや読めないファイルで検査全体を落とさない。
    // ファイル 1 つの都合で、他のファイルの報告まで消える方が損
    return { code: null, error: error.message }
  }
}

async function checkFile(relativePath, { outputRoot, origin, isResolved, findings }) {
  const absolute = resolve(outputRoot, relativePath)
  const file = toPosix(relativePath)

  const report = (line, column, rule, message) => findings.push({ file, line, column, rule, message })

  const { code, error: readError } = await readTarget(absolute)
  if (readError) {
    report(1, 1, 'unreadable-file', `読めませんでした: ${readError}`)
    return
  }

  let references = []
  let baseHref = null

  if (/\.css$/i.test(relativePath)) {
    const result = collectCssReferences(code, absolute)
    if (result.error) {
      report(1, 1, 'unreadable-css', `CSS を解析できませんでした: ${result.error}`)
      return
    }
    references = result.references
  } else {
    ;({ references, baseHref } = collectHtmlReferences(code))
  }

  for (const reference of references) {
    const urlPath = referencePath(reference.value, { origin, outputRoot, fromFile: absolute, baseHref })
    if (urlPath === null) continue
    if (isResolved(urlPath)) continue

    report(reference.line, reference.column, RULE, `参照が見つかりません: ${reference.value}`)
  }
}

/**
 * @param context BuildContext（production で作る。paths.outputRoot と config を使う）
 */
export async function checkReferences(context) {
  const { paths, config } = context
  const outputRoot = paths.outputRoot
  const origin = String(config.siteUrl ?? '').replace(/\/+$/, '')

  const files = await listTargets(outputRoot)
  const notices = []

  if (files.length === 0) {
    notices.push('出力に .html も .css もありません。参照は検査していません')
    return { findings: [], notices }
  }

  const findings = []
  const isResolved = createResolver(outputRoot)

  await runWithConcurrency(files, FILE_CONCURRENCY, file =>
    checkFile(file, { outputRoot, origin, isResolved, findings })
  )

  // 並列に処理するので、積まれる順は実行のたびに変わる。
  // 公開 API の戻り値が実行ごとに変わらないよう、ここで並べ直す
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)

  return { findings, notices }
}
