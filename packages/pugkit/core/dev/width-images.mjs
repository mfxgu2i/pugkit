import { existsSync, readFileSync } from 'node:fs'
import { readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import sizeOf from 'image-size'
import { convertExtension, parseWidthName, supportsWidthVariants } from '../../utils/image-density.mjs'
import { CONVERTIBLE_EXTENSIONS } from '../../utils/image-formats.mjs'
import { writeWidthVariant } from '../../tasks/image.mjs'
import { contains } from '../../utils/safe-dir.mjs'
import { stripSubdir } from './page-source.mjs'

/**
 * dev で幅違いをリクエスト時に生成する。
 *
 * 起動時に作らないのは、幅が imageInfo() の呼び出し側で決まるためで、
 * まだ開いていないページが要求する幅を起動時には知りようがない（docs/adr/0011）。
 *
 * 生成の可否は URL だけで決め、収集した幅は見ない。dev はページ HTML が
 * キャッシュに載っているとレンダリングを通らないので、収集結果は常に不完全になる。
 * それを可否の根拠にすると、同じ URL がどのページを開いたかによって 200 と 404 を行き来する。
 */

/**
 * 1 画像あたりに作る幅違いの上限。
 *
 * URL だけで決める以上、原寸 1600px の画像には @1w から @1599w まで
 * すべてが条件を通る。歯止めが無いと 1 枚のページで千を超えるエンコードが走る
 */
const MAX_WIDTHS_PER_IMAGE = 32

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif'
}

/**
 * 「_」始まりのセグメントを含むか。build の IMAGE_IGNORE と同じ扱いにする。
 *
 * 判定するのは URL 由来のパスなので、区切りは常に「/」。path.sep で分けると
 * Windows では 1 つのセグメントとして扱われ、dev だけが `_` 配下を配信する
 */
function isHidden(urlRelativePath) {
  return urlRelativePath.split('/').some(segment => segment.startsWith('_'))
}

/**
 * 出力名から元画像を探す。
 *
 * 拡張子は build の glob（CONVERTIBLE_GLOB）と同じ大小区別で見る。existsSync だけに頼ると、
 * 大文字小文字を区別しないファイルシステムで `hero.JPG` が当たってしまい、
 * build では 1 枚も出ないのに dev だけ 200 を返すことになる。
 *
 * 候補が 2 つ以上あるときは作らない。どちらを元にするかを探索順まかせにしない
 */
async function findSource(outputRelative, ext, format, srcDir) {
  const dir = resolve(srcDir, dirname(outputRelative))
  const stem = basename(outputRelative)
  const entries = await readdir(dir).catch(() => [])

  const candidates = entries.filter(entry => {
    const entryExt = extname(entry)

    if (!CONVERTIBLE_EXTENSIONS.includes(entryExt.slice(1))) return false
    if (basename(entry, entryExt) !== stem) return false

    // その元画像が実際にこの拡張子の出力を生むか（compress モードは読み替えない）
    return extname(convertExtension(entry, format)) === ext
  })

  return candidates.length === 1 ? resolve(dir, candidates[0]) : null
}

/**
 * リクエスト URL を「作るべき幅違い」に解決する。作らないなら null。
 *
 * @param urlPath デコード済みのパス
 */
async function resolveWidthRequest(urlPath, context, subdir) {
  const { paths, config } = context

  const withoutSubdir = stripSubdir(urlPath, subdir)
  if (withoutSubdir === null) return null

  // parseWidthName はビルドが作る綴りだけを読む（1 以上、先頭ゼロなし）
  const parsed = parseWidthName(withoutSubdir)
  if (!parsed) return null

  const outputRelative = parsed.base.replace(/^\//, '')
  if (!outputRelative || isHidden(outputRelative)) return null

  // 書き込み先は要求された名前そのもの。記述子を落とすと元画像を上書きする。
  // 出力ルートの外に出ないことも確かめる。`/..%2F..%2Fevil@400w.webp` は
  // decodeURIComponent を通ると dev キャッシュの外を指し、ファイル書き込みの原始能力になる
  const outputPath = resolve(paths.output, withoutSubdir.replace(/^\//, ''))
  if (!contains(paths.output, outputPath)) return null

  // すでに置かれているものには触らない。2 回目以降は sirv がそのまま返し、
  // public から複写されたファイルを勝手に上書きすることもない
  if (existsSync(outputPath)) return null

  const sourcePath = await findSource(outputRelative, parsed.ext, config.build.image.format, paths.src)
  if (!sourcePath || !contains(paths.src, sourcePath)) return null

  // SVG と GIF は幅の対象外。密度と同じ集合にそろえる
  if (!supportsWidthVariants(sourcePath)) return null

  // 剪定の判定は参照側と同じ image-size で行う。sharp と食い違うと
  // 「HTML が指しているのに 404」か「誰も参照しない孤児」が出る
  const { width, height } = sizeOf(readFileSync(sourcePath))
  if (!width || parsed.width >= width) return null

  return { sourcePath, outputPath, width: parsed.width, size: { width, height } }
}

/**
 * 幅違いのリクエストに応じるハンドラを作る。セッションごとに 1 つ。
 *
 * 返り値は出力先の絶対パスと Content-Type。作らない場合は null
 *
 * @param subdir URL の前置き。core/server.mjs が subdirPrefix() で作ったものをそのまま渡す
 */
export function createWidthImageResponder(context, subdir = '') {
  const inFlight = new Map()
  const generated = new Map()

  const withinCap = (sourcePath, width) => {
    const known = generated.get(sourcePath) ?? new Set()
    if (known.has(width)) return true
    if (known.size >= MAX_WIDTHS_PER_IMAGE) return false

    known.add(width)
    generated.set(sourcePath, known)
    return true
  }

  /**
   * 一時ファイルに書いてから置き換える。sharp の toFile は不可分ではないので、
   * 直接書くと配信中に切り詰められた壊れた画像が出る。失敗した書きかけも残らない
   */
  const generate = async ({ sourcePath, outputPath, width, size }) => {
    const tempPath = `${outputPath}.tmp-${process.pid}`

    try {
      const written = await writeWidthVariant(sourcePath, tempPath, width, size, context)
      if (!written) return null

      await rename(tempPath, outputPath)
      return outputPath
    } catch (error) {
      await rm(tempPath, { force: true })
      context.warnOnce?.(
        'server',
        'width-image-failed',
        `幅違いの生成に失敗しました: ${relative(context.paths.src, sourcePath)} (${width}w): ${error.message}`
      )
      return null
    }
  }

  return async function respondWithWidthImage(urlPath) {
    const request = await resolveWidthRequest(urlPath, context, subdir)
    if (!request) return null

    const contentType = CONTENT_TYPES[extname(request.outputPath)]
    if (!contentType) return null

    if (!withinCap(request.sourcePath, request.width)) {
      // 超えた後はリクエストのたびに当たるので、画像ごとに 1 度だけ知らせる
      const name = relative(context.paths.src, request.sourcePath)
      context.warnOnce?.(
        'server',
        `width-cap:${request.sourcePath}`,
        `幅違いの生成が 1 画像あたり ${MAX_WIDTHS_PER_IMAGE} 件を超えました: ${name}。これ以上は 404 になります。幅を試している途中なら dev を再起動してください`
      )
      return null
    }

    // 同じ出力先への同時リクエストを畳む。2 本が同時に書くと片方が壊れる
    if (!inFlight.has(request.outputPath)) {
      inFlight.set(
        request.outputPath,
        generate(request).finally(() => inFlight.delete(request.outputPath))
      )
    }

    const path = await inFlight.get(request.outputPath)
    return path ? { path, contentType } : null
  }
}
