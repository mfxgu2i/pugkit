import { resolve } from 'node:path'
import { assertSafeToWipe } from '../utils/safe-dir.mjs'
import { normalizeSubdir } from '../utils/subdir.mjs'
import { resolveFromRoot } from '../utils/paths.mjs'
import { existsSync } from 'node:fs'
import { defaultConfig } from './defaults.mjs'
import { inspectConfigKeys, RENAMED_KEYS } from './schema.mjs'
import { logger } from '../utils/logger.mjs'
import { normalizeSourceDensity, VALID_SOURCE_DENSITIES } from '../utils/image-density.mjs'

const IMAGE_FORMATS = ['avif', 'webp', 'compress']

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
 * 画像設定を混ぜる。丸ごと差し替えにすると、`options.webp.quality` だけ指定した
 * ときに他の形式の既定値ごと消える
 */
function mergeImage(defaults, user = {}) {
  const image = mergeShallow(defaults, user)

  image.overrides = mergeShallow(defaults.overrides, user.overrides)

  // 形式の一覧は既定値から取る。形式を増やしてもここを直さなくて済む
  image.options = Object.fromEntries(
    Object.keys(defaults.options).map(format => [
      format,
      mergeShallow(defaults.options[format], user.options?.[format])
    ])
  )

  return image
}

/**
 * 既知のキーだけを組み立てる。以降は「config は解決済み」として扱えるよう、
 * 実在しないキーは通さない（知らせるのは validateKeys の仕事）
 */
function mergeBuild(defaults, user = {}) {
  return {
    image: mergeImage(defaults.image, user.image),
    html: mergeShallow(defaults.html, user.html)
  }
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
 * 設定キーの誤りを知らせる。混ぜる前の、利用者が書いたそのままの形を見る。
 *
 * 旧名のキーは中止する。移行先が一意に決まるうえ、放置すると指定したはずの値が
 * 効かないまま出力される。実在しないキーは綴り違いとは限らないので警告に留める
 */
function validateKeys(userConfig) {
  const { renamed, unknown } = inspectConfigKeys(userConfig)

  if (renamed.length > 0) {
    const lines = renamed.map(key => `  ${key}  →  ${RENAMED_KEYS[key]}`)
    throw new Error(
      `pugkit.config.mjs に v1 のキーが残っています。指定した値が無視されるため中止しました。\n${lines.join('\n')}`
    )
  }

  if (unknown.length > 0) {
    logger.warn('config', `pugkit.config.mjs に不明なキーがあります（無視されます）: ${unknown.join(', ')}`)
  }
}

/**
 * 画像まわりの設定を正規化する。
 *
 * 不正な値を黙って通すと、全画像が意図しない寸法で出力されるという静かな壊れ方をする。
 * 中止まではせず、安全側（変換あり・縮小なし）に倒して知らせる。
 */
function normalizeImageConfig(image) {
  if (!IMAGE_FORMATS.includes(image.format)) {
    logger.warn(
      'config',
      `Unknown build.image.format "${image.format}". 'webp' として扱います（有効な値: ${IMAGE_FORMATS.join(' / ')}）。変換したくない画像は public/ に置いてください`
    )
    image.format = 'webp'
  }

  const density = normalizeSourceDensity(image.sourceDensity)
  if (density === null) {
    logger.warn(
      'config',
      `Unknown build.image.sourceDensity "${image.sourceDensity}". 1 として扱います（有効な値: ${VALID_SOURCE_DENSITIES.join(' / ')}）`
    )
    image.sourceDensity = 1
  } else {
    image.sourceDensity = density
  }

  return image
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
  validateKeys(userConfig)
  const config = mergeConfig(defaultConfig, userConfig)
  normalizeImageConfig(config.build.image)
  // CLI は `pugkit build .` のように相対パスを渡してくる。
  // 絶対パス前提で使う箇所（esbuild の absWorkingDir など）があるのでここで一度だけ解決する
  config.root = resolve(root)
  applyInlineConfig(config, inlineConfig)
  validateConfig(config)
  return config
}
