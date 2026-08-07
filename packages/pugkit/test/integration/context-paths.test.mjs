import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { BuildContext } from '../../core/context.mjs'

let root
let rootWithoutPkg

function createConfig(overrides = {}, projectRoot = root) {
  return { root: projectRoot, outDir: 'dist', ...overrides }
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'pugkit-ctx-'))
  await writeFile(resolve(root, 'package.json'), '{"name":"x"}')
  await mkdir(resolve(root, 'node_modules'), { recursive: true })

  rootWithoutPkg = await mkdtemp(join(tmpdir(), 'pugkit-ctx-nopkg-'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
  await rm(rootWithoutPkg, { recursive: true, force: true })
})

describe('BuildContext output paths', () => {
  it('should write to outDir in production', () => {
    const context = new BuildContext(createConfig(), 'production')
    expect(context.paths.outputRoot).toBe(resolve(root, 'dist'))
    expect(context.paths.output).toBe(resolve(root, 'dist'))
  })

  it('should not touch outDir in development', () => {
    const context = new BuildContext(createConfig(), 'development')
    expect(context.paths.outputRoot).not.toBe(resolve(root, 'dist'))
    expect(context.paths.outputRoot).toBe(resolve(root, 'node_modules/.pugkit/dev'))
  })

  it('should fall back to .pugkit when package.json is absent', () => {
    const context = new BuildContext(createConfig({}, rootWithoutPkg), 'development')
    expect(context.paths.outputRoot).toBe(resolve(rootWithoutPkg, '.pugkit/dev'))
  })

  it('should honor an explicit cacheDir', () => {
    const context = new BuildContext(createConfig({ cacheDir: '.tmp/devout' }), 'development')
    expect(context.paths.outputRoot).toBe(resolve(root, '.tmp/devout'))
  })

  it('should honor an absolute cacheDir', () => {
    const abs = resolve(tmpdir(), 'pugkit-abs-cache')
    const context = new BuildContext(createConfig({ cacheDir: abs }), 'development')
    expect(context.paths.outputRoot).toBe(abs)
  })

  it('should ignore cacheDir in production', () => {
    const context = new BuildContext(createConfig({ cacheDir: '.tmp/devout' }), 'production')
    expect(context.paths.outputRoot).toBe(resolve(root, 'dist'))
  })

  it('should apply subdir under the dev cache in development', () => {
    const context = new BuildContext(createConfig({ subdir: 'sub' }), 'development')
    expect(context.paths.output).toBe(resolve(root, 'node_modules/.pugkit/dev/sub'))
  })

  it('should apply subdir under outDir in production', () => {
    const context = new BuildContext(createConfig({ subdir: 'sub' }), 'production')
    expect(context.paths.output).toBe(resolve(root, 'dist/sub'))
  })
})

describe('cacheDir safety', () => {
  // dev 起動のたびに中身を削除するため、消してはいけない場所は起動前に弾く
  const destructive = [
    ['プロジェクトルート', '.'],
    ['プロジェクトルート(末尾スラッシュ)', './'],
    ['親ディレクトリ', '..'],
    ['さらに上の階層', '../..'],
    ['正規化すると親になるパス', 'sub/../..'],
    ['src', 'src'],
    ['public', 'public'],
    ['outDir', 'dist']
  ]

  it.each(destructive)('should reject %s', (_label, cacheDir) => {
    expect(() => new BuildContext(createConfig({ cacheDir }), 'development')).toThrow()
  })

  it('should reject an absolute path that contains the project root', () => {
    expect(() => new BuildContext(createConfig({ cacheDir: '/' }), 'development')).toThrow()
  })

  it('should reject outDir even when it is an absolute path', () => {
    const abs = resolve(tmpdir(), 'pugkit-abs-out')
    expect(() => new BuildContext(createConfig({ outDir: abs, cacheDir: abs }), 'development')).toThrow()
  })

  it('should allow a directory nested under the project root', () => {
    const context = new BuildContext(createConfig({ cacheDir: '.tmp/cache' }), 'development')
    expect(context.paths.outputRoot).toBe(resolve(root, '.tmp/cache'))
  })

  it('should not validate cacheDir in production (it is never used there)', () => {
    expect(() => new BuildContext(createConfig({ cacheDir: '.' }), 'production')).not.toThrow()
  })

  it('should reject a cacheDir nested inside outDir (dev output would pollute the build output)', () => {
    expect(() => new BuildContext(createConfig({ cacheDir: 'dist/.cache' }), 'development')).toThrow()
  })

  it('should reject a cacheDir nested inside src or public', () => {
    expect(() => new BuildContext(createConfig({ cacheDir: 'src/.cache' }), 'development')).toThrow()
    expect(() => new BuildContext(createConfig({ cacheDir: 'public/.cache' }), 'development')).toThrow()
  })
})

describe('subdir normalization', () => {
  // 先頭スラッシュが残ると resolve() が絶対パス扱いし、出力先が outDir の外に出る
  it.each([['sub'], ['sub/'], ['/sub'], ['/sub/'], ['//sub//']])(
    'should keep %s inside outDir in production',
    subdir => {
      const context = new BuildContext(createConfig({ subdir }), 'production')
      expect(context.paths.output).toBe(resolve(root, 'dist/sub'))
    }
  )

  it('should keep a leading-slash subdir inside the dev cache', () => {
    const context = new BuildContext(createConfig({ subdir: '/sub' }), 'development')
    expect(context.paths.output).toBe(resolve(root, 'node_modules/.pugkit/dev/sub'))
  })

  it('should support nested subdir', () => {
    const context = new BuildContext(createConfig({ subdir: '/a/b/' }), 'production')
    expect(context.paths.output).toBe(resolve(root, 'dist/a/b'))
  })
})
