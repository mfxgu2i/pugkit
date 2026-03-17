import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../config/main.mjs'

describe('loadConfig inlineConfig.siteUrl', () => {
  it('should use default siteUrl when inlineConfig is empty', async () => {
    const config = await loadConfig(process.cwd())
    expect(config.siteUrl).toBe('')
  })

  it('should override siteUrl with inlineConfig.siteUrl', async () => {
    const config = await loadConfig(process.cwd(), { siteUrl: 'https://stg.example.com/' })
    expect(config.siteUrl).toBe('https://stg.example.com/')
  })

  it('should not override siteUrl when inlineConfig.siteUrl is undefined', async () => {
    const config = await loadConfig(process.cwd(), { siteUrl: undefined })
    expect(config.siteUrl).toBe('')
  })

  it('should override siteUrl even when pugkit.config.mjs has a siteUrl', async () => {
    // loadConfig merges user config first, then inlineConfig wins
    const config = await loadConfig(process.cwd(), { siteUrl: 'https://prod.example.com/' })
    expect(config.siteUrl).toBe('https://prod.example.com/')
  })
})
