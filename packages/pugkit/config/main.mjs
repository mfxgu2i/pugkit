import { resolve } from 'node:path'
import { assertSafeToWipe } from '../utils/safe-dir.mjs'
import { normalizeSubdir } from '../utils/subdir.mjs'
import { resolveFromRoot } from '../utils/paths.mjs'
import { existsSync } from 'node:fs'
import { defaultConfig } from './defaults.mjs'
import { logger } from '../utils/logger.mjs'
import { normalizeSourceDensity, VALID_SOURCE_DENSITIES } from '../utils/image-density.mjs'

const IMAGE_OPTIMIZATIONS = ['avif', 'webp', 'compress']

async function loadUserConfig(root) {
  const configPath = resolve(root, 'pugkit.config.mjs')

  if (!existsSync(configPath)) return {}

  try {
    const module = await import(configPath)
    return module.default || {}
  } catch (error) {
    logger.warn('config', `pugkit.config.mjs を読み込めませんでした（既定値で続行します）: ${error.message}`)
    return {}
  }
}

const mergeShallow = (defaults, user) => ({ ...defaults, ...(user ?? {}) })

/**
 * build 配下で、丸ごと差し替えではなくキー単位で混ぜるもの。
 *
 * 差し替えにすると、`html.indent_size` だけ指定したときに他の整形設定が
 * 既定値ごと消える。imageOptions は形式ごとに同じ扱いが要るので別に見る
 */
const MERGED_BUILD_KEYS = ['imageInfo', 'imageOverrides', 'html']

function mergeBuild(defaults, user = {}) {
  const build = mergeShallow(defaults, user)

  for (const key of MERGED_BUILD_KEYS) {
    build[key] = mergeShallow(defaults[key], user[key])
  }

  // 形式の一覧は既定値から取る。形式を増やしてもここを直さなくて済む
  build.imageOptions = Object.fromEntries(
    Object.keys(defaults.imageOptions).map(format => [
      format,
      mergeShallow(defaults.imageOptions[format], user.imageOptions?.[format])
    ])
  )

  return build
}

function mergeConfig(defaults, user) {
  return {
    siteUrl: user.siteUrl ?? defaults.siteUrl,
    subdir: normalizeSubdir(user.subdir ?? defaults.subdir),
    outDir: user.outDir ?? defaults.outDir,
    cacheDir: user.cacheDir ?? defaults.cacheDir,
    server: mergeShallow(defaults.server, user.server),
    build: mergeBuild(defaults.build, user.build)
  }
}

/**
 * 画像まわりの設定を正規化する。
 *
 * 不正な値を黙って通すと、全画像が意図しない寸法で出力されるという静かな壊れ方をする。
 * 中止まではせず、安全側（変換あり・縮小なし）に倒して知らせる。
 */
function normalizeImageConfig(build) {
  if (!IMAGE_OPTIMIZATIONS.includes(build.imageOptimization)) {
    logger.warn(
      'config',
      `Unknown imageOptimization "${build.imageOptimization}". 'webp' として扱います（有効な値: ${IMAGE_OPTIMIZATIONS.join(' / ')}）。変換したくない画像は public/ に置いてください`
    )
    build.imageOptimization = 'webp'
  }

  const density = normalizeSourceDensity(build.imageSourceDensity)
  if (density === null) {
    logger.warn(
      'config',
      `Unknown imageSourceDensity "${build.imageSourceDensity}". 1 として扱います（有効な値: ${VALID_SOURCE_DENSITIES.join(' / ')}）`
    )
    build.imageSourceDensity = 1
  } else {
    build.imageSourceDensity = density
  }

  return build
}

/**
 * build は outDir を丸ごと削除してから書き出す。指定を誤るとソースや依存が消え、
 * しかも削除は成功扱いなので失ってから気づくことになる。警告ではなく中止する。
 */
function validateConfig(config) {
  const root = config.root
  const resolvedOutDir = resolveFromRoot(root, config.outDir)

  assertSafeToWipe(resolvedOutDir, {
    label: 'outDir',
    protect: [
      [root, 'プロジェクトルート'],
      [resolve(root, 'src'), 'src'],
      [resolve(root, 'public'), 'public'],
      [resolve(root, 'node_modules'), 'node_modules']
    ],
    keepOut: [
      [resolve(root, 'src'), 'src'],
      [resolve(root, 'public'), 'public']
    ],
    keepOutReason: 'ビルド出力がソースに混ざります'
  })

  return config
}

/**
 * CLI のオプションを設定に上書きする。
 *
 * 設定ファイルの読み込みと同じ場所で当てることで、以降は「config は解決済み」として
 * 扱える。ビルダーを作ったあとに context.config を書き換えると、その値を
 * 既に読んでしまった箇所とずれる
 */
function applyInlineConfig(config, inline) {
  if (inline.siteUrl !== undefined && inline.siteUrl !== null) config.siteUrl = inline.siteUrl
  if (inline.port !== undefined && inline.port !== null) config.server.port = inline.port
  if (inline.host !== undefined && inline.host !== null) config.server.host = inline.host
}

export async function loadConfig(root = process.cwd(), inlineConfig = {}) {
  const userConfig = await loadUserConfig(root)
  const config = mergeConfig(defaultConfig, userConfig)
  normalizeImageConfig(config.build)
  // CLI は `pugkit build .` のように相対パスを渡してくる。
  // 絶対パス前提で使う箇所（esbuild の absWorkingDir など）があるのでここで一度だけ解決する
  config.root = resolve(root)
  applyInlineConfig(config, inlineConfig)
  validateConfig(config)
  return config
}
