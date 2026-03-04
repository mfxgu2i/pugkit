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

function mergeConfig(defaults, user) {
  return {
    siteUrl: user.siteUrl || defaults.siteUrl,
    subdir: user.subdir || defaults.subdir,
    outDir: user.outDir !== undefined ? user.outDir : defaults.outDir,
    debug: user.debug !== undefined ? user.debug : defaults.debug,
    server: { ...defaults.server, ...(user.server || {}) },
    build: {
      ...defaults.build,
      ...(user.build || {}),
      clean: user.build?.clean !== undefined ? user.build.clean : defaults.build.clean,
      imageOptions: {
        webp: { ...defaults.build.imageOptions.webp, ...(user.build?.imageOptions?.webp || {}) },
        jpeg: { ...defaults.build.imageOptions.jpeg, ...(user.build?.imageOptions?.jpeg || {}) },
        png: { ...defaults.build.imageOptions.png, ...(user.build?.imageOptions?.png || {}) },
        avif: { ...defaults.build.imageOptions.avif, ...(user.build?.imageOptions?.avif || {}) }
      },
      imageInfo: {
        ...defaults.build.imageInfo,
        ...(user.build?.imageInfo || {})
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

  if (isSameAsRoot || isParentOfRoot) {
    console.warn(
      `[pugkit] outDir "${outDir}" はプロジェクトルートと同じか親ディレクトリです。` +
        `ソースファイルが上書きされる可能性があるため、別のディレクトリを指定してください。`
    )
  }

  return config
}

export async function loadConfig(root = process.cwd()) {
  const userConfig = await loadUserConfig(root)
  const config = mergeConfig(defaultConfig, userConfig)
  config.root = root
  validateConfig(config)
  return config
}

export async function resolveConfig(inlineConfig = {}) {
  const root = inlineConfig.root || process.cwd()
  const config = await loadConfig(root)

  if (inlineConfig.server) {
    Object.assign(config.server, inlineConfig.server)
  }

  return config
}
