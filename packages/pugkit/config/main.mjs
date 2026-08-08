import { resolve, isAbsolute } from 'node:path'
import { assertSafeToWipe } from '../utils/safe-dir.mjs'
import { normalizeSubdir } from '../utils/subdir.mjs'
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
    console.warn(`Failed to load pugkit.config.mjs: ${error.message}`)
    return {}
  }
}

function mergeConfig(defaults, user) {
  return {
    siteUrl: user.siteUrl || defaults.siteUrl,
    subdir: normalizeSubdir(user.subdir || defaults.subdir),
    outDir: user.outDir !== undefined ? user.outDir : defaults.outDir,
    cacheDir: user.cacheDir !== undefined ? user.cacheDir : defaults.cacheDir,
    server: { ...defaults.server, ...(user.server || {}) },
    build: {
      ...defaults.build,
      ...(user.build || {}),
      imageOptions: {
        webp: { ...defaults.build.imageOptions.webp, ...(user.build?.imageOptions?.webp || {}) },
        jpeg: { ...defaults.build.imageOptions.jpeg, ...(user.build?.imageOptions?.jpeg || {}) },
        png: { ...defaults.build.imageOptions.png, ...(user.build?.imageOptions?.png || {}) },
        avif: { ...defaults.build.imageOptions.avif, ...(user.build?.imageOptions?.avif || {}) }
      },
      imageInfo: {
        ...defaults.build.imageInfo,
        ...(user.build?.imageInfo || {})
      },
      imageOverrides: {
        ...defaults.build.imageOverrides,
        ...(user.build?.imageOverrides || {})
      },
      html: {
        ...defaults.build.html,
        ...(user.build?.html || {})
      }
    }
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
  const resolvedOutDir = isAbsolute(config.outDir) ? config.outDir : resolve(root, config.outDir)

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

export async function loadConfig(root = process.cwd(), inlineConfig = {}) {
  const userConfig = await loadUserConfig(root)
  const config = mergeConfig(defaultConfig, userConfig)
  normalizeImageConfig(config.build)
  // CLI は `pugkit build .` のように相対パスを渡してくる。
  // 絶対パス前提で使う箇所（esbuild の absWorkingDir など）があるのでここで一度だけ解決する
  config.root = resolve(root)
  if (inlineConfig.siteUrl !== undefined && inlineConfig.siteUrl !== null) {
    config.siteUrl = inlineConfig.siteUrl
  }
  validateConfig(config)
  return config
}
