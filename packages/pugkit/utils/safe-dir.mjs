import { isAbsolute, relative } from 'node:path'

/**
 * parent が child を内包しているか（同じパスも内包とみなす）。
 *
 * outDir と cacheDir はどちらも中身を丸ごと削除される。判定を書き分けると
 * 片方だけ守りが甘くなるので、ここ一箇所に置く。
 * relative() を使うことで Windows のバックスラッシュでも正しく動く。
 */
export function contains(parent, child) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * 中身を丸ごと削除する対象として安全かを確かめる。
 *
 * @param dir 削除される側のディレクトリ（絶対パス）
 * @param label 設定名。エラー文言に出す
 * @param protect [パス, 呼び名] の配列。dir がこれらを内包していたら拒否する
 * @param keepOut [パス, 呼び名] の配列。dir がこれらの配下なら拒否する
 * @param keepOutReason 配下を拒否する理由
 */
export function assertSafeToWipe(dir, { label, protect, keepOut = [], keepOutReason = '' }) {
  for (const [target, name] of protect) {
    if (contains(dir, target)) {
      throw new Error(`[pugkit] ${label} に${name}を含むパスは指定できません。中身が削除されます: ${dir}`)
    }
  }

  for (const [target, name] of keepOut) {
    if (contains(target, dir)) {
      throw new Error(`[pugkit] ${label} に${name}の配下は指定できません。${keepOutReason}: ${dir}`)
    }
  }
}
