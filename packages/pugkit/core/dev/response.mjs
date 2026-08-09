import path from 'node:path'

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

/**
 * ビルドエラー時に返すページ。ライブリロードスクリプト入りなので修正保存で自動復帰する。
 */
export function buildErrorPage(pugFile, error, paths, errorPageScript) {
  const rel = path.relative(paths.src, pugFile)
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Build Error - pugkit</title>
<style>
  body { background: #1b1b1f; color: #e0e0e0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; padding: 40px; }
  h1 { color: #ff6b6b; font-size: 18px; }
  .file { color: #ffd166; margin-bottom: 16px; }
  pre { background: #111; padding: 16px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; line-height: 1.6; }
  p.hint { color: #888; font-size: 12px; }
</style>
</head>
<body>
<h1>Pug Build Error</h1>
<div class="file">${escapeHtml(rel)}</div>
<pre>${escapeHtml(error.message)}</pre>
<p class="hint">ファイルを修正して保存すると自動でリロードされます。</p>
${errorPageScript}
</body>
</html>`
}

export function sendHtml(res, status, html, extraHeaders) {
  const buf = Buffer.from(html, 'utf-8')
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache',
    ...extraHeaders
  })
  res.end(buf)
}

/**
 * 静的配信の失敗を受け止める包み。
 *
 * sirv はファイルの存在を確認してから読み出すが、その間に消える可能性を扱っていない。
 * dev では watcher の削除・キャッシュの作り直しと配信が日常的に競合するため、
 * 素のまま使うと dev サーバーがプロセスごと落ちる（エラーページも自動復帰も無い）。
 *
 * 失敗の出方が2通りあるので両方を受け止める:
 *   - 存在確認（statSync）の失敗 → 同期 throw。ここで catch する
 *   - 読み出し（createReadStream）の失敗 → ストリームの 'error'。
 *     配信先の 'pipe' イベントで読み取り元を掴んで listener を付ける
 *
 * 応答を始めた後は本文の続きを送れないので接続を切る。まだなら次の候補に回す。
 */
export function guardStaticServe(serve, onError = () => {}) {
  return (req, res, next) => {
    const fail = error => {
      onError(error)
      res.destroy()
    }

    res.once('pipe', source => source.on('error', fail))

    try {
      serve(req, res, next)
    } catch (error) {
      onError(error)
      if (res.headersSent) res.destroy()
      else next()
    }
  }
}

export function injectReload(html, liveReloadScript) {
  // 置換文字列に第三者コードを渡すため、$& や $` が特殊解釈されないよう関数形式で置換する
  return html.includes('</body>')
    ? html.replace('</body>', () => liveReloadScript + '</body>')
    : html + liveReloadScript
}
