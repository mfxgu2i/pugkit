import { glob } from 'glob'
import { stat, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, extname, relative } from 'node:path'
import sharp from 'sharp'
import { logger } from '../utils/logger.mjs'
import { loadConfig } from '../config/index.mjs'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * '400KB' / '1.5MB' / '102400' などをバイト数に変換
 */
function parseThreshold(value) {
  if (typeof value === 'number') return value
  const str = String(value).trim().toUpperCase()
  const match = str.match(/^([\d.]+)\s*(KB|MB|B)?$/)
  if (!match) throw new Error(`Invalid threshold value: "${value}"`)
  const num = parseFloat(match[1])
  const unit = match[2] || 'B'
  if (unit === 'MB') return Math.round(num * 1024 * 1024)
  if (unit === 'KB') return Math.round(num * 1024)
  return Math.round(num)
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function formatRatio(original, compressed) {
  const pct = ((original - compressed) / original) * 100
  return `-${pct.toFixed(0)}%`
}

function pad(str, len) {
  return String(str).padEnd(len)
}

function padL(str, len) {
  return String(str).padStart(len)
}

/** ANSIカラー */
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
}

// ──────────────────────────────────────────────
// Sharp シミュレーション
// ──────────────────────────────────────────────

/**
 * 画像を1回だけデコードして raw ピクセルデータとメタ情報を返す
 * 以降のシミュレーションはこれを使い回す（ディスク再読み込みなし）
 */
async function decodeImage(filePath) {
  const fileBuffer = await readFile(filePath)
  const { data, info } = await sharp(fileBuffer).raw().toBuffer({ resolveWithObject: true })
  return { fileBuffer, rawData: data, info }
}

/**
 * raw ピクセルデータから sharp インスタンスを生成
 */
function fromRaw(rawData, info) {
  return sharp(rawData, {
    raw: { width: info.width, height: info.height, channels: info.channels }
  })
}

/**
 * 現在の config 設定でシミュレートしたバイト数を返す（rawData 使い回し）
 */
async function getCurrentSimulatedSize(rawData, info, ext, config) {
  const optimization = config.build.imageOptimization
  const opts = config.build.imageOptions
  const image = fromRaw(rawData, info)

  if (optimization === 'webp') {
    return (await image.webp(opts.webp).toBuffer()).length
  }
  if (optimization === 'avif') {
    return (await image.avif(opts.avif).toBuffer()).length
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return (await image.jpeg(opts.jpeg).toBuffer()).length
  }
  if (ext === '.png') {
    return (await image.png(opts.png).toBuffer()).length
  }
  return null // GIF 等は非対応
}

/**
 * 指定フォーマット・品質でシミュレートしたバイト数を返す（rawData 使い回し）
 */
async function simulateFormat(rawData, info, format, quality, imageOptions) {
  const image = fromRaw(rawData, info)
  if (format === 'webp') {
    return (await image.webp({ ...imageOptions.webp, quality }).toBuffer()).length
  }
  if (format === 'avif') {
    return (await image.avif({ ...imageOptions.avif, quality }).toBuffer()).length
  }
  if (format === 'jpeg') {
    return (await image.jpeg({ ...imageOptions.jpeg, quality }).toBuffer()).length
  }
  if (format === 'png') {
    return (await image.png(imageOptions.png).toBuffer()).length
  }
  throw new Error(`Unknown format: ${format}`)
}

/**
 * 現在の config から "current format" と "current quality" を取得
 */
function getCurrentFormatInfo(filePath, config) {
  const optimization = config.build.imageOptimization
  if (optimization === 'webp') {
    return { format: 'webp', quality: config.build.imageOptions.webp.quality }
  }
  if (optimization === 'avif') {
    return { format: 'avif', quality: config.build.imageOptions.avif.quality }
  }
  const ext = extname(filePath).toLowerCase().replace('.', '')
  const format = ext === 'jpg' ? 'jpeg' : ext
  const quality = config.build.imageOptions[format]?.quality ?? null
  return { format, quality }
}

// ──────────────────────────────────────────────
// ファイル収集
// ──────────────────────────────────────────────

async function collectImages(root, target) {
  const srcDir = resolve(root, 'src')

  if (!target) {
    // デフォルト: src/ 以下全体
    return await glob('**/*.{jpg,jpeg,png}', {
      cwd: srcDir,
      absolute: true,
      ignore: ['**/_*/**']
    })
  }

  const targetPath = resolve(root, target)

  if (!existsSync(targetPath)) {
    throw new Error(`Target not found: ${targetPath}`)
  }

  const s = await stat(targetPath)
  if (s.isDirectory()) {
    return await glob('**/*.{jpg,jpeg,png}', {
      cwd: targetPath,
      absolute: true,
      ignore: ['**/_*/**']
    })
  }

  // 単一ファイル
  const ext = extname(targetPath).toLowerCase()
  if (!/\.(jpg|jpeg|png)$/.test(ext)) {
    throw new Error(`Unsupported file type: ${targetPath}`)
  }
  return [targetPath]
}

// ──────────────────────────────────────────────
// テーブル表示
// ──────────────────────────────────────────────

function printWarningTable(rows, thresholdStr) {
  const W_FILE = Math.max(30, ...rows.map(r => r.rel.length))
  const FMT_W = 7 // format 列幅
  const SZ_W = 9 // size 列幅
  // 各セル幅: col1=W_FILE+1, col2=FMT_W+2, col3=SZ_W+1
  const sep = `${'─'.repeat(W_FILE + 1)}┬${'─'.repeat(FMT_W + 2)}┬${'─'.repeat(SZ_W + 1)}`

  console.log()
  console.log(`${c.yellow}⚠ ${rows.length} image(s) exceed threshold (${thresholdStr}) with current config${c.reset}`)
  console.log(sep)
  console.log(` ${pad('file', W_FILE)}│ ${pad('format', FMT_W)} │ ${padL('size', SZ_W)}`)
  console.log(sep)
  for (const r of rows) {
    const sizeStr = formatBytes(r.simulatedSize) // ← simulatedSize を使用
    console.log(` ${pad(r.rel, W_FILE)}│ ${pad(r.format, FMT_W)} │ ${c.yellow}${padL(sizeStr, SZ_W)}${c.reset}`)
  }
  console.log(sep)
}

function printSimulationTable(rows, originalSize, currentQuality) {
  const Q_W = 7 // quality 列幅
  const S_W = 9 // size 列幅
  const R_W = 9 // ratio 列幅
  // 各セル幅: col1=Q_W+2, col2=S_W+2, col3=R_W+2, col4=8
  const sep = `${'─'.repeat(Q_W + 2)}┬${'─'.repeat(S_W + 2)}┬${'─'.repeat(R_W + 2)}┬${'─'.repeat(8)}`

  console.log(sep)
  console.log(` ${padL('quality', Q_W)} │ ${padL('size', S_W)} │ ${padL('ratio', R_W)} │ budget`)
  console.log(sep)

  for (const row of rows) {
    const sizeStr = formatBytes(row.size)
    const ratioStr = formatRatio(originalSize, row.size)
    const budgetStr = row.ok ? `${c.green}✔${c.reset}` : `${c.yellow}⚠${c.reset}`
    const isCurrent = row.quality === currentQuality
    const currentMark = isCurrent ? `${c.dim} ← current${c.reset}` : ''

    console.log(
      ` ${padL(row.quality ?? '-', Q_W)} │ ${padL(sizeStr, S_W)} │ ${padL(ratioStr, R_W)} │ ${budgetStr}${currentMark}`
    )
  }
  console.log(sep)
}

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────

export async function benchImage(options = {}) {
  const { root = process.cwd(), target } = options

  const config = await loadConfig(root)
  const benchCfg = config.benchmark?.image ?? {}

  // オプションは config のみで解決
  const thresholdStr = benchCfg.threshold ?? '400KB'
  const threshold = parseThreshold(String(thresholdStr))
  const qualityMin = parseInt(benchCfg.qualityMin ?? 40)
  const qualityMax = parseInt(benchCfg.qualityMax ?? 90)
  const qualityStep = parseInt(benchCfg.qualityStep ?? 10)

  // ファイル収集
  let images
  try {
    images = await collectImages(root, target)
  } catch (err) {
    logger.error('bench', err.message)
    process.exit(1)
  }

  if (images.length === 0) {
    logger.skip('bench', 'No images found')
    return
  }

  const srcDir = resolve(root, 'src')
  logger.info('bench', `Scanning ${images.length} image(s)  (threshold: ${thresholdStr})`)

  // ── Step 1: 現在の config でシミュレート → 閾値超えを検出 ──
  // 1枚ずつ順番に処理（大量画像でのメモリスパイクを防ぐ）
  const overThreshold = []

  for (const filePath of images) {
    const ext = extname(filePath).toLowerCase()
    const s = await stat(filePath)

    // GIF 等はスキップ
    if (!/\.(jpg|jpeg|png)$/.test(ext)) continue

    // 1回だけデコード（このスコープを抜けると GC 対象）
    const { rawData, info } = await decodeImage(filePath)
    const simulatedSize = await getCurrentSimulatedSize(rawData, info, ext, config)

    if (simulatedSize !== null && simulatedSize > threshold) {
      const { format } = getCurrentFormatInfo(filePath, config)
      overThreshold.push({
        filePath,
        rel: relative(srcDir, filePath),
        originalSize: s.size,
        simulatedSize,
        format,
        rawData, // Step 2 で使い回す
        info
      })
    }
    // rawData を overThreshold に入れない場合はここで GC される
  }

  if (overThreshold.length === 0) {
    logger.success('bench', `All images are within threshold (${thresholdStr})`)
    return
  }

  // 警告テーブル
  printWarningTable(overThreshold, thresholdStr)

  // imageOverrides サジェスト収集
  const suggestions = []

  // ── Step 2: 閾値超え画像ごとにシミュレーション ──
  for (const item of overThreshold) {
    const { filePath, rel, originalSize, rawData, info } = item
    const { format: currentFormat, quality: currentQuality } = getCurrentFormatInfo(filePath, config)

    // メタ情報は Step 1 で取得済みの info を使う（再読み込みなし）
    const dim = info.width && info.height ? `  ${info.width}×${info.height}` : ''

    console.log()
    console.log(
      `${c.bold}Simulation: ${rel}${c.reset}  ${c.dim}(original: ${formatBytes(originalSize)}${dim})${c.reset}`
    )

    const rows = []

    // 現在の設定を先頭に
    rows.push({
      format: currentFormat,
      quality: currentQuality,
      size: item.simulatedSize,
      ok: item.simulatedSize <= threshold
    })

    // 現在のフォーマット固定で quality のみ変化（既存の imageOptions の他設定は維持）
    for (let q = qualityMin; q <= qualityMax; q += qualityStep) {
      if (q === currentQuality) continue
      const size = await simulateFormat(rawData, info, currentFormat, q, config.build.imageOptions)
      rows.push({ format: currentFormat, quality: q, size, ok: size <= threshold })
    }

    // quality 昇順ソート（current は固定で先頭）
    const [current, ...rest] = rows
    rest.sort((a, b) => a.quality - b.quality)

    console.log(`${c.dim} format: ${currentFormat}  (effort / other options follow config)${c.reset}`)
    printSimulationTable([current, ...rest], originalSize, currentQuality)

    // 推奨サジェスト：閾値以内で最も高い quality（品質を最大限残す）
    const passing = rest.filter(r => r.ok)
    if (passing.length > 0) {
      const best = passing[passing.length - 1] // quality 昇順の末尾 = 最高品質
      console.log(
        `${c.green}★ Recommended: quality ${best.quality}  →  ${formatBytes(best.size)} (${formatRatio(originalSize, best.size)})${c.reset}`
      )
      suggestions.push({ rel, quality: best.quality })
    } else {
      console.log(`${c.yellow}  No quality within threshold. Consider resizing the source image.${c.reset}`)
    }
  }

  // ── imageOverrides スニペット出力 ──
  if (suggestions.length > 0) {
    console.log()
    console.log(`${c.cyan}💡 Apply to pugkit.config.mjs:${c.reset}`)
    console.log(`${c.dim}   build: {${c.reset}`)
    console.log(`${c.dim}     imageOverrides: {${c.reset}`)
    for (const s of suggestions) {
      console.log(`${c.dim}       '${s.rel}': { quality: ${s.quality} },${c.reset}`)
    }
    console.log(`${c.dim}     }${c.reset}`)
    console.log(`${c.dim}   }${c.reset}`)
  }

  console.log()
}

export async function bench(options = {}) {
  await benchImage(options)
}
