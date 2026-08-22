import { subdirPrefix } from '../utils/subdir.mjs'
import { relative } from 'node:path'

/**
 * siteUrl が空のとき、絶対URLを組み立てるプロパティにだけ通知を挟む。
 *
 * siteUrl が空でも href は "/about/" のような相対パスとして返る。OGP や canonical に
 * そのまま入れても例外にならず、HTML を1枚ずつ開かない限り本番まで気づけない。
 * 設定を読んだ時点で知らせると、絶対URLを使わないプロジェクトにも毎回出てしまうので、
 * テンプレートが実際に参照した時にだけ通知する。
 *
 * pathname は siteUrl に依らないため通知しない。相対リンクだけで組む案件は
 * ここしか触らず、その使い方は正しい
 */
function notifyOnAbsoluteUrl(url, notify) {
  const guard = value => {
    notify()
    return value
  }

  return {
    get origin() {
      return guard(url.origin)
    },
    get base() {
      return guard(url.base)
    },
    pathname: url.pathname,
    get href() {
      return guard(url.href)
    }
  }
}

/**
 * pathname は subdir を含む。URL としてそのまま使える値にするため（docs/adr/0016）。
 * href との関係も URL 標準と同じ origin + pathname になる。
 * src 配下の並びが欲しい場合は subdir の前置きを外す。pugkit 内部なら stripSubdir()、
 * テンプレート側には渡していないので Builder.url.pathname.slice(Builder.subdir.length) になる。
 *
 * @param options.onMissingSiteUrl siteUrl が空のまま絶対URLが参照されたときに呼ばれる
 */
export function createBuilderVars(filePath, paths, config, { onMissingSiteUrl } = {}) {
  const relativePath = relative(paths.src, filePath)
  const normalizedPath = relativePath.replace(/\\/g, '/')
  const depth = normalizedPath.split('/').length - 1
  const autoDir = depth === 0 ? './' : '../'.repeat(depth)

  let autoPageUrl = normalizedPath

  if (autoPageUrl.endsWith('index.pug')) {
    autoPageUrl = autoPageUrl.replace(/index\.pug$/, '')
  } else {
    autoPageUrl = autoPageUrl.replace(/\.pug$/, '.html')
  }

  const siteUrl = config.siteUrl || ''
  const subdir = subdirPrefix(config.subdir)
  const origin = siteUrl.replace(/\/$/, '')
  const base = origin + subdir
  const pagePath = autoPageUrl ? (autoPageUrl.startsWith('/') ? autoPageUrl : '/' + autoPageUrl) : '/'
  const pathname = subdir + pagePath
  const href = origin + pathname

  const url = { origin, base, pathname, href }

  return {
    dir: autoDir,
    subdir,
    url: siteUrl === '' && onMissingSiteUrl ? notifyOnAbsoluteUrl(url, onMissingSiteUrl) : url
  }
}
