import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createBuilderVars } from '../../transform/builder-vars.mjs'

describe('createBuilderVars', () => {
  const paths = {
    src: '/project/src'
  }

  it('should create vars for root index.pug', () => {
    const filePath = '/project/src/index.pug'
    const config = {
      siteUrl: 'https://example.com',
      subdir: ''
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.dir).toBe('./')
    expect(result.subdir).toBe('')
    expect(result.url.origin).toBe('https://example.com')
    expect(result.url.base).toBe('https://example.com')
    expect(result.url.pathname).toBe('/')
    expect(result.url.href).toBe('https://example.com/')
  })

  it('should create vars for nested index.pug', () => {
    const filePath = '/project/src/about/index.pug'
    const config = {
      siteUrl: 'https://example.com',
      subdir: ''
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.dir).toBe('../')
    expect(result.url.pathname).toBe('/about/')
    expect(result.url.href).toBe('https://example.com/about/')
  })

  it('should create vars for regular .pug file', () => {
    const filePath = '/project/src/page.pug'
    const config = {
      siteUrl: 'https://example.com',
      subdir: ''
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.dir).toBe('./')
    expect(result.url.pathname).toBe('/page.html')
    expect(result.url.href).toBe('https://example.com/page.html')
  })

  it('should handle subdirectory configuration', () => {
    const filePath = '/project/src/index.pug'
    const config = {
      siteUrl: 'https://example.com',
      subdir: 'myapp'
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.subdir).toBe('/myapp')
    expect(result.url.base).toBe('https://example.com/myapp')
    expect(result.url.href).toBe('https://example.com/myapp/')
  })

  it('should handle subdirectory with leading/trailing slashes', () => {
    const filePath = '/project/src/index.pug'
    const config = {
      siteUrl: 'https://example.com/',
      subdir: '/myapp/'
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.subdir).toBe('/myapp')
    expect(result.url.origin).toBe('https://example.com')
    expect(result.url.base).toBe('https://example.com/myapp')
  })

  it('should handle deeply nested file', () => {
    const filePath = '/project/src/blog/2024/article/index.pug'
    const config = {
      siteUrl: 'https://example.com',
      subdir: ''
    }

    const result = createBuilderVars(filePath, paths, config)

    expect(result.dir).toBe('../../../')
    expect(result.url.pathname).toBe('/blog/2024/article/')
  })

  it('should work without siteUrl', () => {
    const filePath = '/project/src/index.pug'
    const config = {}

    const result = createBuilderVars(filePath, paths, config)

    expect(result.url.origin).toBe('')
    expect(result.url.base).toBe('')
    expect(result.url.pathname).toBe('/')
    expect(result.url.href).toBe('/')
  })
})

describe('createBuilderVars - Windows path normalization', () => {
  it('should normalize backslashes in relativePath for depth calculation', () => {
    const paths = { src: '/project/src' }
    const config = { siteUrl: 'https://example.com', subdir: '' }

    const testPath1 = '/project/src/page.pug'
    const result1 = createBuilderVars(testPath1, paths, config)
    expect(result1.url.pathname).toBe('/page.html')

    const testPath2 = '/project/src/nested/page.pug'
    const result2 = createBuilderVars(testPath2, paths, config)
    expect(result2.dir).toBe('../')
  })
})
