import { describe, expect, it } from 'vitest'
import { changeExtension } from '../../utils/file.mjs'

describe('changeExtension', () => {
  it('should change file extension', () => {
    const result = changeExtension('file.txt', '.md')
    expect(result).toBe('file.md')
  })

  it('should change nested file extension', () => {
    const result = changeExtension('path/to/file.pug', '.html')
    expect(result).toBe('path/to/file.html')
  })

  it('should add extension if no extension exists', () => {
    const result = changeExtension('file', '.js')
    expect(result).toBe('file.js')
  })

  it('should handle files with multiple dts', () => {
    const result = changeExtension('file.backup.txt', '.md')
    expect(result).toBe('file.backup.md')
  })

  it('should handle empty extension', () => {
    const result = changeExtension('file.txt', '')
    expect(result).toBe('file')
  })
})
