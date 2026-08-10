import { glob } from 'glob'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname, basename } from 'node:path'
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

/**
 * icons ディレクトリ（src からの相対パス）に対応するスプライトの出力先。
 * 生成側と後始末側で規則がずれると、消したはずのアイコンが配信され続ける
 */
export function spriteOutputPath(iconDir, paths) {
  return resolve(paths.output, dirname(iconDir), 'icons.svg')
}

/**
 * SVGスプライト生成タスク
 */
export async function spriteTask(context) {
  const { paths } = context

  // iconsディレクトリを検索（「_」始まりのディレクトリ配下はビルド対象外）
  const iconDirs = await glob('**/icons', {
    cwd: paths.src,
    absolute: false,
    ignore: ['**/_*/**']
  })

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
  const svgFiles = await glob('*.svg', {
    cwd: iconDir,
    absolute: true
  })

  if (svgFiles.length === 0) {
    // 作り直さないだけだと、消したアイコンを参照する <use> が解決し続けてしまう。
    // pugkit が生成したファイルなので clean: false でも消してよい
    await rm(outputPath, { force: true })
    return 0
  }

  const symbols = []

  for (const svgFile of svgFiles) {
    const fileName = basename(svgFile, '.svg')
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
      .replace(/<svg[^>]*>/, () => `<symbol id="${fileName}" viewBox="${viewBox}">`)
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
