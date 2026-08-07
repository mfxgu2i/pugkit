import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { resolvePugSource } from '../../core/server.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * URL から配信する Pug ソースを決める規則。
 * 候補順は sirv（= 本番の静的配信）に合わせ、パーシャルと src 外は配信しない。
 */
describe('resolvePugSource', () => {
  let paths

  beforeEach(async () => {
    const project = await createTempProject({
      'src/index.pug': 'p index',
      'src/about.pug': 'p about',
      'src/blog.pug': 'p blog-flat',
      'src/blog/index.pug': 'p blog',
      'src/docs/index.pug': 'p docs',
      'src/_partials/_header.pug': 'header',
      'src/_drafts/page.pug': 'p draft',
      'secret.pug': 'p secret'
    })
    paths = { src: project.path('src') }
  })

  it('should resolve / to src/index.pug', () => {
    expect(resolvePugSource('/', paths)).toBe(resolve(paths.src, 'index.pug'))
  })

  it('should resolve /about.html to src/about.pug', () => {
    expect(resolvePugSource('/about.html', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should resolve extensionless /about to src/about.pug', () => {
    expect(resolvePugSource('/about', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should prefer flat .pug over index.pug (sirv-compatible order)', () => {
    expect(resolvePugSource('/blog', paths)).toBe(resolve(paths.src, 'blog.pug'))
    expect(resolvePugSource('/blog/', paths)).toBe(resolve(paths.src, 'blog.pug'))
  })

  it('should fall back to index.pug when no flat .pug exists', () => {
    expect(resolvePugSource('/docs', paths)).toBe(resolve(paths.src, 'docs/index.pug'))
    expect(resolvePugSource('/docs/', paths)).toBe(resolve(paths.src, 'docs/index.pug'))
  })

  it('should resolve /blog/index.html to blog/index.pug', () => {
    expect(resolvePugSource('/blog/index.html', paths)).toBe(resolve(paths.src, 'blog/index.pug'))
  })

  it('should match .html case-insensitively', () => {
    expect(resolvePugSource('/about.HTML', paths)).toBe(resolve(paths.src, 'about.pug'))
  })

  it('should return null for missing pages', () => {
    expect(resolvePugSource('/nope.html', paths)).toBeNull()
    expect(resolvePugSource('/nope/', paths)).toBeNull()
  })

  it('should return null for non-html extensions', () => {
    expect(resolvePugSource('/css/style.css', paths)).toBeNull()
    expect(resolvePugSource('/img/a.png', paths)).toBeNull()
  })

  it('should not serve partials or underscore directories', () => {
    expect(resolvePugSource('/_partials/_header.html', paths)).toBeNull()
    expect(resolvePugSource('/_drafts/page.html', paths)).toBeNull()
    expect(resolvePugSource('/_drafts/page', paths)).toBeNull()
  })

  it('should not escape src (path traversal)', () => {
    expect(resolvePugSource('/../secret.html', paths)).toBeNull()
    expect(resolvePugSource('/blog/../../secret.html', paths)).toBeNull()
  })

  describe('with subdir', () => {
    const subdir = '/sub'

    it('should strip the subdir prefix', () => {
      expect(resolvePugSource('/sub/about.html', paths, subdir)).toBe(resolve(paths.src, 'about.pug'))
      expect(resolvePugSource('/sub/', paths, subdir)).toBe(resolve(paths.src, 'index.pug'))
      expect(resolvePugSource('/sub', paths, subdir)).toBe(resolve(paths.src, 'index.pug'))
    })

    it('should not resolve URLs without the subdir prefix', () => {
      expect(resolvePugSource('/about.html', paths, subdir)).toBeNull()
      expect(resolvePugSource('/', paths, subdir)).toBeNull()
    })

    it('should not match prefix across segment boundaries', () => {
      expect(resolvePugSource('/subfoo/about.html', paths, subdir)).toBeNull()
    })
  })
})
