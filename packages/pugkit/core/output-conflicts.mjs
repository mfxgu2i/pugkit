import { glob } from 'glob'
import { relative } from 'node:path'
import { imageOutputPaths } from '../tasks/image.mjs'
import { svgOutputPath, SVG_GLOB, SVG_IGNORE } from '../tasks/svg.mjs'
import { spriteOutputPath } from '../tasks/svg-sprite.mjs'
import { publicOutputPath } from '../tasks/copy.mjs'
import { IMAGE_GLOB, IMAGE_IGNORE } from '../tasks/image.mjs'

/**
 * 出力先の一意性を、タスクをまたいで一度だけ確かめる。
 *
 * `image` / `svg` / `copy` は同じフェーズで並列に走るため、同じ場所に二人以上が
 * 書くと、どちらが残るかは書き込みが着地した順で決まる。片方を黙って捨てると
 * 「置いたはずのファイルが使われていない」ことに気づけないので中止する。
 *
 * 各タスクが自分の出力先だけを見ても衝突は分からない（相手の存在が要る）ので、
 * 判定はタスクの外に置く。出力先の導出規則そのものは各タスクが持ち、ここは
 * それを集めて突き合わせるだけにする。
 */

// パス比較は区切り文字を揃えてから行う（glob は「/」、path.relative は OS 依存）
const normalize = p => p.replace(/\\/g, '/')

/** 出力の相対パス → それを書く担当（表示用の名前） */
async function collectOwners(context) {
  const { paths, config } = context
  const owners = new Map()
  const conflicts = []

  // 突き合わせの鍵は「出力ルートからの相対パス」。絶対パスの導出は各タスクの
  // *OutputPath に任せ、ここはそれを共通の形に直すだけにする
  const claim = (absoluteOutput, source) => {
    const key = normalize(relative(paths.output, absoluteOutput))
    const existing = owners.get(key)
    if (existing && existing !== source) conflicts.push({ output: key, a: existing, b: source })
    else owners.set(key, source)
  }

  const [images, svgs, publicFiles] = await Promise.all([
    glob(IMAGE_GLOB, { cwd: paths.src, ignore: IMAGE_IGNORE }),
    glob(SVG_GLOB, { cwd: paths.src, ignore: SVG_IGNORE }),
    glob('**/*', { cwd: paths.public, nodir: true, dot: true })
  ])

  for (const rel of images) {
    for (const out of imageOutputPaths(rel, config, paths)) claim(out.absolute, `src/${normalize(rel)}`)
  }

  for (const rel of svgs) claim(svgOutputPath(rel, paths), `src/${normalize(rel)}`)

  // スプライトは icons ディレクトリごとに 1 ファイルを生成する
  const iconDirs = new Set(
    (await glob('**/icons/**/*.svg', { cwd: paths.src, ignore: ['**/_*/**'] })).map(rel =>
      normalize(rel).replace(/\/icons\/.*$/, '/icons')
    )
  )
  for (const dir of iconDirs) claim(spriteOutputPath(dir, paths), `sprite(${dir})`)

  // copy は public からの相対パスをそのまま出力ルート下に置く（tasks/copy.mjs と同じ規則）
  for (const rel of publicFiles) claim(publicOutputPath(rel, paths), `public/${normalize(rel)}`)

  return conflicts
}

/**
 * 衝突があれば中止する。build は書き出す前に、dev は起動時に一度だけ呼ぶ。
 * 変更のたびには呼ばない（衝突は設定ミスであり、build が最終的な関門になる）
 */
export async function assertUniqueOutputs(context) {
  const conflicts = await collectOwners(context)
  if (conflicts.length === 0) return

  const lines = conflicts.map(c => `  ${c.output}  ←  ${c.a} / ${c.b}`)
  throw new Error(`出力先が衝突しています。どちらが残るかが決まらないため中止しました。\n${lines.join('\n')}`)
}
