import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, extname } from 'node:path'
import sizeOf from 'image-size'
import {
  densityOutputs,
  hasScaledVariant,
  normalizeWidths,
  pruneWidths,
  scaleDown,
  sourceDensityOf,
  supportsDensity,
  supportsWidthVariants
} from '../utils/image-density.mjs'
import { logger as defaultLogger } from '../utils/logger.mjs'

/**
 * 画像の実寸を読む。同じ画像は複数ページから参照されるので、
 * 読み取り結果はセッション中（= BuildContext の寿命）使い回す。
 *
 * 保持するのは寸法だけで、画像のバイト列は残さない
 * （読むのはヘッダだけなのに全体を抱えると、写真の多いサイトで際限なく増える）
 */
function readImageSize(filePath, cache) {
  const cached = cache.getImageSize(filePath)
  if (cached) return cached

  const { width, height, type } = sizeOf(readFileSync(filePath))
  const size = { width, height, type }
  cache.setImageSize(filePath, size)
  return size
}

/**
 * srcset は「カンマ + 空白」区切りのリストなので、URL に空白やカンマが入ると
 * 候補の切れ目を誤らせて srcset ごと壊れる。支給画像には空白入りのファイル名が混ざる。
 * 日本語などは区切りにならないのでそのままにし、読みやすさを保つ
 */
function encodeSrcsetUrl(url) {
  return url.replace(/\s/g, '%20').replace(/,/g, '%2C')
}

/**
 * Pug から参照された画像パスを実ファイルへ解決する。
 * 「/」始まりは src からの絶対参照、それ以外はページからの相対参照。
 * src に無ければ public も見る（public に置いた画像も HTML から参照されるため）。
 *
 * public 由来かどうかを返すのは、public は copy されるだけで変換も縮小もされないため。
 * 見分けずに変換後の拡張子を返すと、存在しないファイルを src に書いて 404 になる
 */
function createImageResolver(filePath, paths) {
  const pageDir = dirname(filePath)

  return src => {
    const resolved = src.startsWith('/') ? resolve(paths.src, src.slice(1)) : resolve(pageDir, src)
    if (existsSync(resolved)) return { path: resolved, fromPublic: false }

    const inPublic = resolve(paths.public, relative(paths.src, resolved))
    return existsSync(inPublic) ? { path: inPublic, fromPublic: true } : null
  }
}

/**
 * Pug に渡す imageInfo ヘルパーを作る。
 *
 * 画像の実寸を読み、build.image.sourceDensity に応じた表示サイズと srcset を返す。
 * あわせてアートディレクション用の派生画像（既定 `_sp`）を自動検出する。
 *
 * 出力名の規則は utils/image-density.mjs に置き、生成側（tasks/image.mjs）と共有する。
 * ここで独自に組み立てると、書いた width/height と実際の画像がずれて CLS になる
 *
 * 寸法のキャッシュは context.cache が持つ。モジュール変数に置くと同じプロセスで
 * 2つ目のビルドを走らせたときに互いのキャッシュを消し合う
 *
 * @param context BuildContext（paths / config / cache を使う）
 * @param logger 差し替え可能。既定は共通ロガー
 */
export function createImageInfoHelper(filePath, context, { onAccess, logger = defaultLogger } = {}) {
  const { paths, config, cache } = context
  const format = config?.build?.image?.format
  const sourceDensity = sourceDensityOf(config)
  const artDirectionSuffix = config?.build?.image?.artDirectionSuffix ?? '_sp'
  const findImageFile = createImageResolver(filePath, paths)

  /**
   * 呼び出し側が渡した幅のうち、実際に作れるものを記録する。
   *
   * 剪定はここでしかしない。生成側が sharp の metadata で独立に剪定すると、
   * image-size と 1px でも食い違ったときに「srcset に載っているのにファイルが無い」か
   * 「誰も参照しない孤児」が出る（docs/adr/0011）
   */
  const recordWidths = (src, found, widths, intrinsicWidth) => {
    if (widths.length === 0) return []

    // public は copyTask がバイト列のまま出すだけで、変換も縮小もされない。
    // 幅違いを作れないので、書かれていても効かないことを知らせる
    if (found.fromPublic) {
      context.warnOnce?.(
        'pug',
        'widths-on-public-image',
        `public/ の画像には widths が効きません: ${src}。幅違いを作るには src/ に置いてください`
      )
      return []
    }

    if (!supportsWidthVariants(src)) return []

    const usable = pruneWidths(widths, intrinsicWidth)
    context.imageWidths?.record(found.path, usable)

    return usable
  }

  /**
   * 参照パスと実ファイルから、出力側の src / 寸法 / srcset を組み立てる。
   * 返す src は最小密度（表示サイズ）側で、srcset の 1x と一致する
   */
  const describe = (src, found, widths = []) => {
    const { width, height, type } = readImageSize(found.path, cache)

    recordWidths(src, found, widths, width)

    // 縮小版が実在しないものは密度 1 として扱う。そうしないと 1x の無い
    // srcset="... 2x" だけを書くことになる（SVG / GIF / public 配下 / 極小画像）
    //
    // public は copyTask がバイト列のまま出すだけなので、変換も密度も適用されない
    const scalable = !found.fromPublic && supportsDensity(src) && hasScaledVariant(width, height, sourceDensity)
    const density = scalable ? sourceDensity : 1
    const outputFormat = found.fromPublic ? null : format

    const entries = densityOutputs(src, outputFormat, density)
      .map(out => ({
        src: out.name,
        density: out.density,
        width: scaleDown(width, density / out.density),
        height: scaleDown(height, density / out.density)
      }))
      .sort((a, b) => a.density - b.density)

    const [smallest] = entries

    return {
      src: smallest.src,
      width: smallest.width,
      height: smallest.height,
      format: type,
      srcset: entries.map(entry => `${encodeSrcsetUrl(entry.src)} ${entry.density}x`).join(', ')
    }
  }

  return (src, options = {}) => {
    const fallback = {
      src,
      width: undefined,
      height: undefined,
      format: undefined,
      isSvg: false,
      srcset: undefined,
      variant: null
    }

    // 幅は呼び出しごとに決まる。使えない値は落として1度だけ知らせる。
    // 共有ミックスインに書かれると、黙って落とすとページ数だけ食い違いが広がる
    const { widths, dropped } = normalizeWidths(options.widths)

    if (dropped.length > 0) {
      context.warnOnce?.(
        'pug',
        'invalid-image-widths',
        `imageInfo の widths に使えない値があります: ${dropped.map(value => JSON.stringify(value)).join(', ')}。正の整数だけを指定してください`
      )
    }

    try {
      const found = findImageFile(src)

      if (!found) {
        logger?.warn('pug', `Image not found "${src}" in ${relative(paths.src, filePath)}`)
        return fallback
      }

      onAccess?.(found.path)

      const ext = extname(src)
      const isSvg = ext.toLowerCase() === '.svg'
      const base = src.slice(0, -ext.length)

      /** アートディレクション用の派生画像（`_sp` など）を探す。無ければ null */
      const findVariant = () => {
        if (isSvg) return null

        const variantSrc = `${base}${artDirectionSuffix}${ext}`
        const variantFound = findImageFile(variantSrc)
        if (!variantFound) return null

        onAccess?.(variantFound.path)
        // _sp にも同じ幅一覧を掛ける。原寸が小さいぶんは剪定で落ちる
        const { format, ...rest } = describe(variantSrc, variantFound, widths)
        return rest
      }

      return { ...describe(src, found, widths), isSvg, variant: findVariant() }
    } catch (error) {
      logger?.warn('pug', `Failed to read "${src}" in ${relative(paths.src, filePath)}: ${error.message}`)
      return fallback
    }
  }
}
