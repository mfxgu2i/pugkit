import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * 統合キャッシュマネージャー
 */
export class CacheManager {
  constructor(mode) {
    this.mode = mode
    this.fileHashes = new Map() // ファイルパス -> ハッシュ
    this.compiledCache = new Map() // Pugコンパイル済みテンプレート
    this.isDevelopment = mode === 'development'
  }

  /**
   * ファイルが変更されたかチェック
   */
  async isFileChanged(filePath) {
    if (!existsSync(filePath)) {
      return false
    }

    const currentHash = await this.computeHash(filePath)
    const cachedHash = this.fileHashes.get(filePath)

    // キャッシュが存在しない場合は変更ありとして扱う
    if (cachedHash === undefined) {
      this.fileHashes.set(filePath, currentHash)
      return true
    }

    if (cachedHash === currentHash) {
      return false
    }

    this.fileHashes.set(filePath, currentHash)
    return true
  }

  /**
   * 複数ファイルの変更をバッチチェック
   */
  async getChangedFiles(filePaths) {
    const checks = await Promise.all(
      filePaths.map(async path => ({
        path,
        changed: await this.isFileChanged(path)
      }))
    )
    return checks.filter(c => c.changed).map(c => c.path)
  }

  /**
   * Pugテンプレートのキャッシュ取得
   */
  getPugTemplate(filePath) {
    return this.compiledCache.get(filePath)
  }

  /**
   * Pugテンプレートをキャッシュに保存
   */
  setPugTemplate(filePath, template) {
    if (this.isDevelopment) {
      this.compiledCache.set(filePath, template)
    }
  }

  /**
   * Pugテンプレートのキャッシュを無効化
   */
  invalidatePugTemplate(filePath) {
    this.compiledCache.delete(filePath)
    this.fileHashes.delete(filePath)
  }

  /**
   * ハッシュ計算（ファイル内容のみ）
   */
  async computeHash(filePath) {
    try {
      const content = await readFile(filePath)
      return createHash('md5').update(content).digest('hex')
    } catch {
      return `error-${Math.random()}`
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  clear() {
    this.fileHashes.clear()
    this.compiledCache.clear()
  }
}
