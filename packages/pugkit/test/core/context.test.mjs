import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { BuildContext } from '../../core/context.mjs'

describe('BuildContext', () => {
  it('should use default outDir "dist" when not specified', () => {
    const config = { root: '/project', outDir: 'dist', subdir: '' }
    const ctx = new BuildContext(config, 'production')
    expect(ctx.paths.dist).toBe(resolve('/project', 'dist'))
  })

  it('should use custom outDir when specified', () => {
    const config = { root: '/project', outDir: 'build', subdir: '' }
    const ctx = new BuildContext(config, 'production')
    expect(ctx.paths.dist).toBe(resolve('/project', 'build'))
  })

  it('should support absolute outDir path', () => {
    const config = { root: '/project', outDir: '/output', subdir: '' }
    const ctx = new BuildContext(config, 'production')
    expect(ctx.paths.dist).toBe(resolve('/output'))
  })

  it('should combine outDir with subdir', () => {
    const config = { root: '/project', outDir: 'build', subdir: 'myapp' }
    const ctx = new BuildContext(config, 'production')
    expect(ctx.paths.dist).toBe(resolve('/project', 'build', 'myapp'))
  })
})
