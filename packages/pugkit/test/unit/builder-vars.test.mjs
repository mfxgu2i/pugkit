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

/**
 * siteUrl が空でも href は "/about/" として返る。OGP や canonical に入れても
 * 例外にならないため、HTML を1枚ずつ開くまで気づけない。
 *
 * 設定を読んだ時点で知らせると、相対リンクだけで組む案件にも毎回出てしまうので、
 * テンプレートが絶対URLを実際に参照した時にだけ知らせる
 */
describe('siteUrl が空のときの通知', () => {
  const paths = { src: '/project/src' }
  const filePath = '/project/src/index.pug'

  const withNotify = (config, options = {}) => {
    const calls = []
    const vars = createBuilderVars(filePath, paths, config, { onMissingSiteUrl: () => calls.push(1), ...options })
    return { vars, calls }
  }

  it.each(['origin', 'base', 'href'])('%s を参照したら知らせる', property => {
    const { vars, calls } = withNotify({})

    expect(vars.url[property]).toBeDefined()
    expect(calls).toHaveLength(1)
  })

  it('pathname では知らせない（siteUrl に依らない値なので）', () => {
    const { vars, calls } = withNotify({})

    expect(vars.url.pathname).toBe('/')
    expect(calls).toEqual([])
  })

  it('siteUrl があれば参照しても知らせない', () => {
    const { vars, calls } = withNotify({ siteUrl: 'https://example.com' })

    expect(vars.url.href).toBe('https://example.com/')
    expect(calls).toEqual([])
  })

  it('通知しても値そのものは変えない', () => {
    const { vars } = withNotify({ subdir: 'sub' })

    expect(vars.url.href).toBe('/sub/')
    expect(vars.url.base).toBe('/sub')
    expect(vars.url.origin).toBe('')
  })

  it('参照するたびに知らせる（受け手が回数を決める）', () => {
    const { vars, calls } = withNotify({})

    vars.url.href
    vars.url.origin

    expect(calls).toHaveLength(2)
  })

  it('通知先を渡さなければ素の値を返す', () => {
    const vars = createBuilderVars(filePath, paths, {})

    expect(vars.url).toEqual({ origin: '', base: '', pathname: '/', href: '/' })
  })
})

describe('subdir の正規化', () => {
  // 正規化は loadConfig で済んでいるが、ここでも独自に整形すると
  // 規則が食い違う。実装を分けない限り、弱い方だけが残って気づけない
  it.each([
    ['sub', '/sub'],
    ['/sub', '/sub'],
    ['sub/', '/sub'],
    ['//sub//', '/sub'],
    ['/a/b/', '/a/b'],
    ['', '']
  ])('subdir: %s -> %s', (input, expected) => {
    const vars = createBuilderVars('/proj/src/index.pug', { src: '/proj/src' }, { subdir: input })

    expect(vars.subdir).toBe(expected)
  })
})
