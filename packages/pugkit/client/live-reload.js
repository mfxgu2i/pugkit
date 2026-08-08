/**
 * dev サーバーがページ末尾に注入するライブリロードクライアント。
 *
 * サーバー側で組み立てず実ファイルにしてあるのは、文字列の中に JS を書くと
 * 構文チェックも整形も効かず、バッククォートや ${} も書けなくなるため。
 *
 * 設定はこのスクリプトタグの data 属性で受け取る:
 *   data-pugkit-signature … このタブが表示している HTML の指紋
 *   data-sse              … リロード通知の購読先
 *   data-scroll           … "0" ならスクロール位置を保持しない
 *   data-dom-diff         … "0" なら差分適用せず常にフルリロード
 *
 * 同期の classic script として body 末尾で実行される前提。document.currentScript が
 * 必要なうえ、この時点の DOM が「サーバー生成そのまま」であることに依存している。
 */
;(function () {
  var SIGNATURE_ATTR = 'data-pugkit-signature'
  var self = document.currentScript
  var ssePath = self.getAttribute('data-sse')
  var scrollEnabled = self.getAttribute('data-scroll') !== '0'
  var domDiffEnabled = self.getAttribute('data-dom-diff') !== '0'
  // このタブが今表示している HTML の指紋。他のタブが何回取得しても影響されない
  var selfSignature = self.getAttribute(SIGNATURE_ATTR)

  var scrollKey = '__pugkit_scroll:' + location.pathname

  // リロード前に保存した位置を復元する（編集のたびに先頭へ戻るのを防ぐ）
  if (scrollEnabled) {
    try {
      var saved = sessionStorage.getItem(scrollKey)
      if (saved !== null) {
        sessionStorage.removeItem(scrollKey)
        // ブラウザ標準の復元（直前ドキュメントの位置＝エラーページ等で 0 になり得る）が
        // load 後にこちらの復元を上書きするため、保存値があるときは手動復元に切り替える
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
        var pos = saved.split(',')
        var sx = parseInt(pos[0], 10) || 0
        var sy = parseInt(pos[1], 10) || 0
        window.scrollTo(sx, sy)
        window.addEventListener('load', function () {
          window.scrollTo(sx, sy)
          setTimeout(function () {
            window.scrollTo(sx, sy)
            if ('scrollRestoration' in history) history.scrollRestoration = 'auto'
          }, 50)
        })
      }
    } catch (e) {}
  }

  function saveScroll() {
    if (!scrollEnabled) return
    try {
      sessionStorage.setItem(scrollKey, window.scrollX + ',' + window.scrollY)
    } catch (e) {}
  }

  function fullReload() {
    saveScroll()
    location.reload()
  }

  // このスクリプトが動く時点（body 末尾）の DOM ＝ サーバー生成そのまま。
  // ここに無い要素は実行時に差し込まれたもの（解析タグ・同意バナー・チャット等）
  // として扱い、差分適用で消さないようにする
  var serverNodes = typeof WeakSet === 'function' ? new WeakSet() : null

  function markServerNodes(root) {
    if (!serverNodes || root.nodeType !== 1) return
    serverNodes.add(root)
    var all = root.querySelectorAll('*')
    for (var i = 0; i < all.length; i++) serverNodes.add(all[i])
  }

  function signatureOf(doc) {
    var tag = doc.querySelector('script[' + SIGNATURE_ATTR + ']')
    return tag && tag.getAttribute(SIGNATURE_ATTR)
  }

  function canMorph() {
    return domDiffEnabled && typeof Idiomorph !== 'undefined'
  }

  function applyMorph() {
    return fetch(location.href, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status)
        return res.text()
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html')
        if (!doc.body) throw new Error('parse failed')
        // morph では <script> が再実行されず head の変更も反映できない。
        // それらが変わっていればフルリロードに退避する
        if (!selfSignature || signatureOf(doc) !== selfSignature) throw new Error('needs full reload')

        // 差分適用は body に限定する。head は解析タグが実行時に差し込んだ要素を
        // 巻き込むため触らない（head の変更は上の指紋比較でフルリロードになる）
        Idiomorph.morph(document.body, doc.body, {
          ignoreActiveValue: true,
          callbacks: {
            beforeNodeMorphed: function (oldNode) {
              // <noscript> の中身はライブ DOM ではテキスト、DOMParser では要素として
              // 解釈される。差分を取ると中の iframe/img が実体化して実際に読み込まれる
              if (oldNode.nodeType === 1 && oldNode.tagName === 'NOSCRIPT') return false
            },
            beforeNodeRemoved: function (node) {
              // 実行時に差し込まれた要素は残す。サーバー生成の要素は Pug から
              // 消されたということなので通常どおり削除する
              if (serverNodes && node.nodeType === 1 && !serverNodes.has(node)) return false
            },
            afterNodeAdded: function (node) {
              markServerNodes(node)
            }
          }
        })
        window.dispatchEvent(new CustomEvent('pugkit:morphed'))
      })
  }

  if (canMorph()) markServerNodes(document.body)

  var es = new EventSource(ssePath)

  es.addEventListener('reload', function (e) {
    var kind = (e && e.data) || 'full'
    if (kind !== 'html' || !canMorph()) {
      fullReload()
      return
    }
    applyMorph().catch(function (err) {
      if (window.console && console.debug) console.debug('[pugkit] full reload:', err && err.message)
      fullReload()
    })
  })

  es.addEventListener('css-update', function () {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var url = new URL(link.href)
      if (url.origin !== location.origin) return
      url.searchParams.set('t', Date.now())
      link.href = url.toString()
    })
  })

  es.onerror = function () {
    es.close()
    setTimeout(function () {
      saveScroll()
      location.reload()
    }, 1000)
  }

  window.addEventListener('beforeunload', function () {
    es.close()
  })
})()
