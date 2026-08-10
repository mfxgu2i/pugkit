import { checkReferences } from './references.mjs'
import { checkMarkup } from './markup.mjs'

/**
 * 検査項目の登録表。
 *
 * 項目を増やすときはここに 1 行足す。CLI も設定も触らない。
 * 各項目は同じ形の findings を返し、整形する側は中身を知らずに並べられる。
 *
 *   { file, line, column, rule, message, severity? }
 *
 * file は出力ルートからの相対パス。
 */
const CHECKS = [
  { id: 'references', title: '参照の実在', run: checkReferences },
  { id: 'markup', title: 'マークアップの妥当性', run: checkMarkup }
]

export const CHECK_IDS = CHECKS.map(check => check.id)

/**
 * 実行する項目を決める。指定が無ければ全部。
 *
 * 知らない id は中止する。黙って無視すると、綴りを間違えた実行が
 * 「違反なし」と同じ表示になる。設定キーの検査と同じ考え方
 */
export function selectChecks(items = []) {
  const requested = items.filter(Boolean)
  if (requested.length === 0) return CHECKS

  const unknown = requested.filter(id => !CHECK_IDS.includes(id))
  if (unknown.length > 0) {
    throw new Error(`知らない検査項目です: ${unknown.join(', ')}\n利用できる項目: ${CHECK_IDS.join(' / ')}`)
  }

  return CHECKS.filter(check => requested.includes(check.id))
}

/**
 * 選ばれた項目を順に走らせて結果をまとめる。
 *
 * 項目どうしは同じ出力を読むだけで干渉しないが、並列にはしない。
 * markuplint 側が既にファイル単位で並列に走るので、外側でも重ねると
 * 同時に開くファイル数が読めなくなる
 */
export async function runChecks(context, items = []) {
  const findings = []
  const notices = []

  for (const check of selectChecks(items)) {
    const result = await check.run(context)
    findings.push(...(result?.findings ?? []))
    notices.push(...(result?.notices ?? []))
  }

  return { findings, notices }
}
