import { glob } from 'glob'
import { relative } from 'node:path'
import { imageOutputPaths } from '../tasks/image.mjs'
import { svgOutputPath, SVG_GLOB, SVG_IGNORE } from '../tasks/svg.mjs'
import { iconDirOf, isReservedSpriteName, spriteOutputPath, SPRITE_FILENAME } from '../tasks/svg-sprite.mjs'
import { publicOutputPath } from '../tasks/copy.mjs'
import { IMAGE_GLOB, IMAGE_IGNORE } from '../tasks/image.mjs'
import { isReservedImageName } from '../utils/image-density.mjs'
import { OUTPUT_EXT_RE } from '../utils/image-formats.mjs'

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
 *
 * 幅違い（`@400w`）だけは突き合わせで見られない。幅は imageInfo() の呼び出し側が
 * 決めるので、相対パスからは何が出るか列挙できないため。代わりに名前を予約し、
 * ビルドが作る形の名前を src と public に置かせないことで肩代わりする（docs/adr/0011）。
 */

// パス比較は区切り文字を揃えてから行う（glob は「/」、path.relative は OS 依存）
const normalize = p => p.replace(/\\/g, '/')

/** 出力の相対パス → それを書く担当（表示用の名前） */
async function collectOwners(context) {
  const { paths, config } = context
  const owners = new Map()
  const conflicts = []
  const reservedImages = []
  const reservedSprites = []

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
    if (isReservedImageName(rel)) reservedImages.push(`src/${normalize(rel)}`)
    for (const out of imageOutputPaths(rel, config, paths)) claim(out.absolute, `src/${normalize(rel)}`)
  }

  for (const rel of svgs) {
    if (isReservedSpriteName(rel)) reservedSprites.push(`src/${normalize(rel)}`)
    claim(svgOutputPath(rel, paths), `src/${normalize(rel)}`)
  }

  // スプライトは icons ディレクトリごとに 1 ファイルを生成する。
  // どのアイコンがどのスプライトに属するかは生成側の iconDirOf に合わせる
  const iconDirs = new Set(
    (await glob('**/icons/**/*.svg', { cwd: paths.src, ignore: ['**/_*/**'] })).map(iconDirOf).filter(Boolean)
  )
  for (const dir of iconDirs) claim(spriteOutputPath(dir, paths), `sprite(${dir})`)

  // copy は public からの相対パスをそのまま出力ルート下に置く（tasks/copy.mjs と同じ規則）
  // public は画像以外も含むので、予約名の検査は画像として出力されうる拡張子に絞る。
  // 絞らないと report@400w.pdf のような無関係なファイルまで中止させる
  for (const rel of publicFiles) {
    if (OUTPUT_EXT_RE.test(rel) && isReservedImageName(rel)) reservedImages.push(`public/${normalize(rel)}`)
    if (isReservedSpriteName(rel)) reservedSprites.push(`public/${normalize(rel)}`)
    claim(publicOutputPath(rel, paths), `public/${normalize(rel)}`)
  }

  return { conflicts, reservedImages, reservedSprites }
}

/**
 * 衝突があれば中止する。build は書き出す前に、dev は起動時に一度だけ呼ぶ。
 * 変更のたびには呼ばない（衝突は設定ミスであり、build が最終的な関門になる）。
 *
 * 予約名も同じ例外にまとめる。別々に投げると、片方を直してもう片方で
 * また止まることになり「全件まとめて報告する」という約束が崩れる
 */
export async function assertUniqueOutputs(context) {
  const { conflicts, reservedImages, reservedSprites } = await collectOwners(context)
  if (conflicts.length === 0 && reservedImages.length === 0 && reservedSprites.length === 0) return

  const sections = []

  if (conflicts.length > 0) {
    const lines = conflicts.map(c => `  ${c.output}  ←  ${c.a} / ${c.b}`)
    sections.push(`出力先が衝突しています。どちらが残るかが決まらないため中止しました。\n${lines.join('\n')}`)
  }

  if (reservedImages.length > 0) {
    const lines = reservedImages.sort().map(name => `  ${name}`)
    sections.push(
      `ビルドが作る名前と同じ形の画像があります。別の名前にしてください。\n` +
        `「@half」と「@<数字>w」は縮小版と幅違いの出力に使います。\n${lines.join('\n')}`
    )
  }

  if (reservedSprites.length > 0) {
    const lines = reservedSprites.sort().map(name => `  ${name}`)
    sections.push(
      `ビルドが作る名前と同じファイルがあります。別の名前にしてください。\n` +
        `「${SPRITE_FILENAME}」は icons ディレクトリから作るスプライトの出力に使います。\n${lines.join('\n')}`
    )
  }

  throw new Error(sections.join('\n\n'))
}
