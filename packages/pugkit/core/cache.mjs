import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// ページHTMLキャッシュの上限（概算バイト）。ページ数の多いサイトを延々と閲覧しても
// メモリが際限なく増えないようにする。超過分は古い順に捨てるが、捨てられたページは
// 次のリクエストで再ビルドされるだけなので正しさには影響しない
const DEFAULT_PAGE_HTML_CACHE_LIMIT = 64 * 1024 * 1024

// V8 は非 Latin-1 を含む文字列を UTF-16 で保持するため、実メモリに近い値として2倍で見積もる
function approximateBytes(html) {
  return html.length * 2
}

/**
 * 統合キャッシュマネージャー
 */
export class CacheManager {
  constructor(mode, { pageHtmlCacheLimit = DEFAULT_PAGE_HTML_CACHE_LIMIT } = {}) {
    this.mode = mode
    this.fileHashes = new Map() // ファイルパス -> ハッシュ
    this.compiledCache = new Map() // Pugコンパイル済みテンプレート
    this.pageHtmlCache = new Map() // ページHTML（dev遅延ビルドの配信キャッシュ / 挿入順=最近使った順）
    this.pageHtmlBytes = 0 // pageHtmlCache の概算バイト数
    this.pageHtmlCacheLimit = pageHtmlCacheLimit
    this.pageEpochs = new Map() // ファイルパス -> 無効化世代
    this.globalPageEpoch = 0 // 全ページ無効化の世代
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
   * epoch を渡した場合、ビルド開始時から無効化が入っていれば保存しない
   * （ビルド中にソースが変更された古い結果の書き戻しを防ぐ）
   */
  setPugTemplate(filePath, template, epoch) {
    if (!this.isDevelopment) return
    if (epoch !== undefined && epoch !== this.getPageEpoch(filePath)) return
    this.compiledCache.set(filePath, template)
  }

  /**
   * Pugテンプレートのキャッシュを無効化
   */
  invalidatePugTemplate(filePath) {
    this.compiledCache.delete(filePath)
    this.fileHashes.delete(filePath)
  }

  /**
   * ページの現在の無効化世代を取得
   */
  getPageEpoch(filePath) {
    return this.globalPageEpoch + (this.pageEpochs.get(filePath) ?? 0)
  }

  /**
   * ページHTMLのキャッシュ取得
   */
  getPageHtml(filePath) {
    const html = this.pageHtmlCache.get(filePath)
    if (html === undefined) return undefined
    // Map は挿入順を保つので、参照のたびに入れ直して「最近使った順」を維持する
    this.pageHtmlCache.delete(filePath)
    this.pageHtmlCache.set(filePath, html)
    return html
  }

  /**
   * ページHTMLをキャッシュに保存
   * epoch がビルド開始時の世代と一致しない場合（＝ビルド中に無効化された場合）は保存しない
   */
  setPageHtml(filePath, html, epoch) {
    if (!this.isDevelopment) return false
    if (epoch !== undefined && epoch !== this.getPageEpoch(filePath)) return false

    const previous = this.pageHtmlCache.get(filePath)
    if (previous !== undefined) this.pageHtmlBytes -= approximateBytes(previous)

    this.pageHtmlCache.delete(filePath)
    this.pageHtmlCache.set(filePath, html)
    this.pageHtmlBytes += approximateBytes(html)

    this.evictPageHtml(filePath)
    return true
  }

  /**
   * 上限を超えた分を古い順に捨てる。
   * 無効化とは違い世代は進めない（内容が古いのではなく、単に保持をやめるだけ）
   */
  evictPageHtml(keep) {
    if (this.pageHtmlBytes <= this.pageHtmlCacheLimit) return

    for (const [filePath, html] of this.pageHtmlCache) {
      if (this.pageHtmlBytes <= this.pageHtmlCacheLimit) break
      if (filePath === keep) continue
      this.pageHtmlCache.delete(filePath)
      this.pageHtmlBytes -= approximateBytes(html)
    }
  }

  /**
   * ページHTMLのキャッシュを無効化（世代を進めて実行中ビルドの書き戻しも防ぐ）
   */
  invalidatePageHtml(filePath) {
    const html = this.pageHtmlCache.get(filePath)
    if (html !== undefined) {
      this.pageHtmlCache.delete(filePath)
      this.pageHtmlBytes -= approximateBytes(html)
    }
    this.pageEpochs.set(filePath, (this.pageEpochs.get(filePath) ?? 0) + 1)
  }

  /**
   * すべてのページHTMLキャッシュを無効化
   */
  clearPageHtml() {
    this.pageHtmlCache.clear()
    this.pageHtmlBytes = 0
    this.globalPageEpoch++
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
    this.pageHtmlCache.clear()
    this.pageHtmlBytes = 0
    // 世代は後退させない: per-file 世代の最大値を global に繰り上げてからクリアすることで
    // 全ページの合成世代が厳密に増加し、実行中ビルドの古い結果が書き戻されることはない
    const maxFileEpoch = this.pageEpochs.size > 0 ? Math.max(...this.pageEpochs.values()) : 0
    this.globalPageEpoch += maxFileEpoch + 1
    this.pageEpochs.clear()
  }
}
