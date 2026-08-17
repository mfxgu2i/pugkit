import { glob } from 'glob'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'
import { optimize } from 'svgo'
import { logger } from '../utils/logger.mjs'
import { ensureFileDir } from '../utils/file.mjs'

/**
 * SVGO設定（スプライト用）
 */
const SPRITE_SVGO_CONFIG = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: {
            minify: false,
            preserve: [],
            preservePrefixes: []
          }
        }
      }
    },
    'removeDimensions',
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [{ xmlns: 'http://www.w3.org/2000/svg' }]
      }
    }
  ]
}

// パス比較は区切り文字を揃えてから行う（glob は「/」、path.relative は OS 依存）
const normalize = p => p.replace(/\\/g, '/')

/** スプライトが書き出すファイル名 */
export const SPRITE_FILENAME = 'icons.svg'

/** icons ディレクトリの探索条件。「_」始まりのディレクトリ配下はビルド対象外 */
export const ICON_DIRS_GLOB = '**/icons'
export const ICON_DIRS_IGNORE = ['**/_*/**']

/**
 * icons ディレクトリの一覧（src からの相対パス）。
 *
 * icons の中の icons を別のスプライトにすると、同じアイコンが2つのスプライトに
 * 入って出力が二重になるので、外側のスプライトに含める
 */
export async function findIconDirs(srcDir) {
  const dirs = await glob(ICON_DIRS_GLOB, { cwd: srcDir, absolute: false, ignore: ICON_DIRS_IGNORE })

  return dirs.filter(dir => iconDirOf(dir) === null)
}

/**
 * src からの相対パスが属する icons ディレクトリ。icons ディレクトリの外なら null。
 *
 * スプライトは icons 配下を再帰的に集めるので、どのアイコンがどのスプライトに
 * 入るかは生成側・検査側・監視側の3箇所が同じ答えを出す必要がある。
 * 規則がずれると、検知されない衝突や消し残しになる
 */
export function iconDirOf(relativePath) {
  const segments = normalize(relativePath).split('/')
  const index = segments.indexOf('icons')
  if (index === -1 || index === segments.length - 1) return null

  return segments.slice(0, index + 1).join('/')
}

/**
 * スプライトの出力と同じ名前か。
 * 利用者が置いた SVG がこの名前だと、生成物と出力先を取り合う。
 * icons ディレクトリの有無で結果が変わらないよう、名前だけで判定する
 */
export function isReservedSpriteName(relativePath) {
  return normalize(relativePath).split('/').pop() === SPRITE_FILENAME
}

/**
 * icons ディレクトリ（src からの相対パス）に対応するスプライトの出力先。
 * 生成側と後始末側で規則がずれると、消したはずのアイコンが配信され続ける
 */
export function spriteOutputPath(iconDir, paths) {
  return resolve(paths.output, dirname(iconDir), SPRITE_FILENAME)
}

/**
 * SVGスプライト生成タスク
 */
export async function spriteTask(context) {
  const { paths } = context

  const iconDirs = await findIconDirs(paths.src)

  if (iconDirs.length === 0) {
    logger.skip('sprite', 'No icons directories found')
    return
  }

  let totalIcons = 0

  // 各iconsディレクトリでスプライト生成
  for (const iconDir of iconDirs) {
    const inputDir = resolve(paths.src, iconDir)
    const outputPath = spriteOutputPath(iconDir, paths)

    const count = await generateSprite(inputDir, outputPath)
    if (count) {
      totalIcons += count
    }
  }

  if (totalIcons > 0) {
    logger.success('sprite', `Generated sprite with ${totalIcons} icon(s)`)
  } else {
    logger.skip('sprite', 'No icons to process')
  }
}

/**
 * SVGスプライト生成
 */
async function generateSprite(iconDir, outputPath) {
  // 直下だけを見ると、サブディレクトリに置いた SVG がスプライトにも個別出力にも
  // 入らないまま消える（svg タスクは icons 配下を丸ごと対象外にしている）
  const found = await glob('**/*.svg', {
    cwd: iconDir,
    absolute: true,
    ignore: ['**/_*/**']
  })

  // glob は readdir の順をそのまま返すので、並び順がファイルシステム任せになる。
  // 中身が同じでも環境が変わると symbol の順が変わり、アイコンを触っていないのに
  // スプライト全体が差分になる。同じ id が並んだときにどちらが勝つかも順序で決まる
  const svgFiles = found.sort()

  if (svgFiles.length === 0) {
    // 作り直さないだけだと、消したアイコンを参照する <use> が解決し続けてしまう。
    // pugkit が生成したファイルなので clean: false でも消してよい
    await rm(outputPath, { force: true })
    return 0
  }

  const symbols = []

  for (const svgFile of svgFiles) {
    // id は icons ディレクトリからの相対パス。直下なら従来どおりファイル名になり、
    // サブディレクトリに分けても別々の id になる
    const symbolId = normalize(relative(iconDir, svgFile)).replace(/\.svg$/, '')
    const svgContent = await readFile(svgFile, 'utf-8')

    // SVGを最適化
    const optimized = optimize(svgContent, SPRITE_SVGO_CONFIG)
    let svg = optimized.data

    // viewBoxを抽出
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24'

    // <svg>タグを<symbol>に変換
    // ファイル名は利用者の入力なので、置換文字列にすると $& などが特殊解釈される
    svg = svg
      .replace(/<svg[^>]*>/, () => `<symbol id="${symbolId}" viewBox="${viewBox}">`)
      .replace(/<\/svg>/, '</symbol>')

    // fill/strokeをcurrentColorに統一
    svg = svg
      .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
      .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"')

    symbols.push(svg)
  }

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbols.join('\n')}
</svg>`

  await ensureFileDir(outputPath)
  await writeFile(outputPath, sprite, 'utf-8')

  return svgFiles.length
}

export default spriteTask
