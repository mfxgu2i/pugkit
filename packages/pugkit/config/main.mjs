import { resolve } from 'node:path'
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
    debug: user.debug !== undefined ? user.debug : defaults.debug,
    server: { ...defaults.server, ...(user.server || {}) },
    build: {
      ...defaults.build,
      ...(user.build || {}),
      imageOptions: {
        webp: { ...defaults.build.imageOptions.webp, ...(user.build?.imageOptions?.webp || {}) },
        jpeg: { ...defaults.build.imageOptions.jpeg, ...(user.build?.imageOptions?.jpeg || {}) },
        png: { ...defaults.build.imageOptions.png, ...(user.build?.imageOptions?.png || {}) }
      }
    }
  }
}

export async function loadConfig(root = process.cwd()) {
  const userConfig = await loadUserConfig(root)
  const config = mergeConfig(defaultConfig, userConfig)
  config.root = root
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
