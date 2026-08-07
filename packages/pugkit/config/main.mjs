import { resolve, isAbsolute, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { defaultConfig } from './defaults.mjs'

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

/**
 * subdir は出力先パスの組み立てにも使うため、前後のスラッシュを落として保持する。
 * 先頭スラッシュが残ると resolve() が絶対パスとして扱い、出力先が outDir の外に出てしまう
 */
export function normalizeSubdir(value) {
  return String(value ?? '').replace(/^[/\\]+|[/\\]+$/g, '')
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
    },
    benchmark: {
      image: {
        ...defaults.benchmark.image,
        ...(user.benchmark?.image || {})
      }
    }
  }
}

function validateConfig(config) {
  const root = config.root
  const outDir = config.outDir
  const resolvedOutDir = isAbsolute(outDir) ? outDir : resolve(root, outDir)

  // relative() を使うことでWindows（バックスラッシュ）でも正しく動作する
  const isSameAsRoot = resolvedOutDir === root
  const relToRoot = relative(resolvedOutDir, root)
  const isParentOfRoot = relToRoot !== '' && !relToRoot.startsWith('..')

  // build の clean はここを rm -rf するため、警告ではなく中止する
  if (isSameAsRoot || isParentOfRoot) {
    throw new Error(
      `[pugkit] outDir "${outDir}" はプロジェクトルートと同じか親ディレクトリです。` +
        `ソースファイルが削除されるため、別のディレクトリを指定してください。`
    )
  }

  return config
}

export async function loadConfig(root = process.cwd(), inlineConfig = {}) {
  const userConfig = await loadUserConfig(root)
  const config = mergeConfig(defaultConfig, userConfig)
  config.root = root
  if (inlineConfig.siteUrl !== undefined && inlineConfig.siteUrl !== null) {
    config.siteUrl = inlineConfig.siteUrl
  }
  validateConfig(config)
  return config
}
