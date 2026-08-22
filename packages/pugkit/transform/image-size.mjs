import { existsSync } from 'node:fs'
import { resolve, relative, dirname, extname } from 'node:path'
import { imageSizeOf } from '../utils/image-dimensions.mjs'
import {
  densityOutputs,
  hasScaledVariant,
  normalizeWidths,
  pruneWidths,
  scaleDown,
  sourceDensityOf,
  supportsDensity,
  supportsWidthVariants,
  widthOutputs
} from '../utils/image-density.mjs'
import { logger as defaultLogger } from '../utils/logger.mjs'
import { stripSubdir, subdirPrefix } from '../utils/subdir.mjs'

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

  const size = imageSizeOf(filePath)
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
 * 「/」始まりはサイトルート起点の URL、それ以外はページからの相対参照。
 * src に無ければ public も見る（public に置いた画像も HTML から参照されるため）。
 *
 * ルート相対を src 起点ではなく URL として解くのは、渡されたパスがそのまま
 * HTML の src になるため。subdir 付きの案件では出力も URL も subdir 配下に入るので、
 * src 起点で解くと本番で 404 になる URL を書くことになる（docs/adr/0015）。
 * リンクの `${Builder.subdir}/about/` と同じ書き方で揃う。
 *
 * public 由来かどうかを返すのは、public は copy されるだけで変換も縮小もされないため。
 * 見分けずに変換後の拡張子を返すと、存在しないファイルを src に書いて 404 になる
 *
 * subdir の付け忘れは missingSubdir で返す。実物はあるので、
 * 「見つからない」とだけ伝えると原因に辿り着けない
 */
function createImageResolver(filePath, paths, subdir) {
  const pageDir = dirname(filePath)

  const findFile = resolved => {
    if (existsSync(resolved)) return { path: resolved, fromPublic: false }

    const inPublic = resolve(paths.public, relative(paths.src, resolved))
    return existsSync(inPublic) ? { path: inPublic, fromPublic: true } : null
  }

  /** URL パスと src 配下の並びは 1 対 1。subdir を外したあとの形で突き合わせる */
  const fromSrcRoot = urlPath => findFile(resolve(paths.src, `.${urlPath}`))

  return src => {
    if (!src.startsWith('/')) return { found: findFile(resolve(pageDir, src)) }

    const urlPath = stripSubdir(src, subdir)
    if (urlPath !== null) return { found: fromSrcRoot(urlPath) }

    return { found: null, missingSubdir: fromSrcRoot(src) !== null }
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
  const findImageFile = createImageResolver(filePath, paths, subdirPrefix(config?.subdir))

  /**
   * 幅モードに入れる参照か。
   *
   * public は copyTask がバイト列のまま出すだけで、変換も縮小もされない。
   * 幅違いを作れないので、書かれていても効かないことを知らせる。
   * SVG と GIF は密度と同じく対象外
   */
  const canUseWidths = (src, found) => {
    if (found.fromPublic) {
      context.warnOnce?.(
        'pug',
        'widths-on-public-image',
        `public/ の画像には widths が効きません: ${src}。幅違いを作るには src/ に置いてください`
      )
      return false
    }

    return supportsWidthVariants(src)
  }

  /**
   * 幅記述子の srcset を組み立てる。
   *
   * 剪定はここでしかしない。生成側が sharp の metadata で独立に剪定すると、
   * 参照側の寸法と 1px でも食い違ったときに「srcset に載っているのにファイルが無い」か
   * 「誰も参照しない孤児」が出る（docs/adr/0011）。
   *
   * src と width/height は原寸。表示幅は sizes が決めるので、ここに表示サイズを焼くと
   * 幅を二重に主張することになる
   */
  const describeWidths = (src, found, widths, sizes, size) => {
    const { width, height, type } = size
    const usable = pruneWidths(widths, width)
    context.imageWidths?.record(found.path, usable)

    const entries = widthOutputs(src, format, usable, width)

    return {
      src: entries.at(-1).name,
      width,
      height,
      format: type,
      srcset: entries.map(entry => `${encodeSrcsetUrl(entry.name)} ${entry.width}w`).join(', '),
      sizes,
      candidates: entries.length
    }
  }

  /**
   * 密度記述子の srcset を組み立てる。
   * 返す src は最小密度（表示サイズ）側で、srcset の 1x と一致する
   */
  const describeDensity = (src, found, size) => {
    const { width, height, type } = size

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
      srcset: entries.map(entry => `${encodeSrcsetUrl(entry.src)} ${entry.density}x`).join(', '),
      // sizes は幅記述子のときだけ意味を持つ。密度記述子に付けても無視される
      sizes: undefined,
      candidates: entries.length
    }
  }

  /**
   * 参照パスと実ファイルから、出力側の src / 寸法 / srcset を組み立てる。
   *
   * モードは呼び出しで決まり、剪定では変わらない。widths を渡した画像は
   * 候補がすべて剪定されても幅モードのままで、無印だけの幅記述子になる
   */
  const describe = (src, found, widths = [], sizes) => {
    const size = readImageSize(found.path, cache)

    return widths.length > 0 && canUseWidths(src, found)
      ? describeWidths(src, found, widths, sizes, size)
      : describeDensity(src, found, size)
  }

  return (src, options = {}) => {
    const fallback = {
      src,
      width: undefined,
      height: undefined,
      format: undefined,
      isSvg: false,
      srcset: undefined,
      sizes: undefined,
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
      const { found, missingSubdir } = findImageFile(src)

      if (!found) {
        const where = `"${src}" in ${relative(paths.src, filePath)}`

        // 実物はあるのに解決できないのは、ルート相対に subdir が付いていないときだけ。
        // 「見つからない」で終えると、置いてある画像を探し回ることになる
        logger?.warn(
          'pug',
          missingSubdir
            ? `Image not found ${where}。ルート相対パスはサイトルート起点で解決します。\`\${Builder.subdir}\` を前置きしてください`
            : `Image not found ${where}`
        )
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
        const { found: variantFound } = findImageFile(variantSrc)
        if (!variantFound) return null

        onAccess?.(variantFound.path)
        // _sp にも同じ幅一覧と sizes を掛ける。原寸が小さいぶんは剪定で落ちる。
        // srcset は候補が 1 つでも必ず出す。source の必須属性なので、
        // 落とすと source ごと無効になって SP 画像が出なくなる
        const { format, candidates, ...rest } = describe(variantSrc, variantFound, widths, options.sizes)
        return rest
      }

      /**
       * 候補が 1 つなら img の srcset を出さない。書いても選びようがなく、
       * 納品する HTML に意味の無い属性が残る。sizes も srcset あってのものなので一緒に落とす
       */
      const { candidates, ...main } = describe(src, found, widths, options.sizes)
      const hasChoice = candidates > 1

      return {
        ...main,
        srcset: hasChoice ? main.srcset : undefined,
        sizes: hasChoice ? main.sizes : undefined,
        isSvg,
        variant: findVariant()
      }
    } catch (error) {
      logger?.warn('pug', `Failed to read "${src}" in ${relative(paths.src, filePath)}: ${error.message}`)
      return fallback
    }
  }
}
