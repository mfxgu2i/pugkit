# スムーススクロール

アンカーリンクのスクロールは、遷移そのものをブラウザに任せ、滑らかにするかどうかだけをJSで切り替える。CSSに `scroll-behavior: smooth` を常時置かない。`preventDefault()` でブラウザの遷移を止めて自前でスクロールし直すこともしない。

## CSSに常時置かない理由

`scroll-behavior: smooth` を `:root` に書くと、そのスクロールコンテナで起きるCSSOM経由のスクロールが全部滑らかになる。アンカーのジャンプだけを狙って書いても、次のものまで巻き込む。

| 巻き込まれるもの | 起きること |
|---|---|
| ドロワーを閉じたときの位置戻し | 保存した位置へ向かってページが流れる |
| フォームのエラー箇所へのフォーカス移動 | 入力に戻るまで待たされる |
| カルーセルやタブが呼ぶ `scrollTo()` | 部品ごとの速さが揃わなくなる |

戻る・進むでのスクロール位置の復元は、静的なMPAでは巻き込まれない。ブラウザ自身の復元は `scroll-behavior` を経由しないので、CSSに書いても即時のままになる。この症状が報告されているのは、フレームワークが `window.scrollTo()` で復元を実装している場合で、そちらはCSSOM経由なので指定を拾う。

滑らかに動かすと、通過する要素の `IntersectionObserver` が順に発火する。ページの上端から下端まで流すと、間にある要素が全部「見えた」ことになる。瞬間ジャンプでは中間が描画されないので発火しない。

## preventDefault しない理由

`preventDefault()` して自前でスクロールすると、ブラウザが持っていた処理を全部やり直すことになる。やり直しは漏れる。

| 標準が持っていたもの | 止めると失うもの |
|---|---|
| 順次フォーカス始点の移動 | Tabの起点が移動先に移らず、リンクの位置から再開する |
| 修飾キー付きクリック、`target` 指定 | 別タブで開けなくなる |
| 別ページへのハッシュ付きリンク | 移動先のidが手元のページにもあると誤爆する |
| `hidden="until-found"` と `<details>` の自動展開 | 閉じた中のidに飛べなくなる |
| `:target` と `hashchange` | `pushState` に置き換えると両方とも動かなくなる |

順次フォーカス始点は、ブラウザがフラグメント遷移のときにTabの再開位置を移動先へ動かす仕組みになる。標準に任せれば `tabindex="-1"` も `focus()` も要らない。`preventDefault()` した場合だけ、`focus()` で自前に補う必要が出る。補い忘れると、移動先に飛んだつもりでフォーカスだけが手前に取り残される。

## 実装

`assets/js/_smoothScroll.js` に置き、`main.js` から `initialize()` を呼ぶ。根になる要素を持たないので `data-module` には載せない。理由は [modules.md](modules.md) にある。ここでは短さのためにJSDocを省いている。実ファイルには他のモジュールと揃えて付ける。

```js
// scrollend が無いブラウザで、スクロールが止まったとみなすまでの間隔
const SCROLL_END_DELAY = 100

// スクロールが一度も起きなかったときに scroll-behavior を戻すまでの上限時間
const FALLBACK_DURATION = 5000

const supportsScrollEnd = 'onscrollend' in window

let cleanup = null

const getHeaderBlockSize = () => {
  const header = document.querySelector('[data-fixed-header]')

  if (!header) return '0'

  const { position, blockSize } = window.getComputedStyle(header)
  const isFixed = position === 'fixed' || position === 'sticky'

  // 追従しないヘッダーは要素と一緒に流れるのでずらさない
  return isFixed ? blockSize : '0'
}

const updateScrollPadding = () => {
  document.documentElement.style.scrollPaddingBlockStart = getHeaderBlockSize()
}

const restoreScrollBehavior = () => {
  if (!cleanup) return

  const run = cleanup
  cleanup = null
  run()
}

// 次に起きるスクロールだけを滑らかにする
const enableSmoothOnce = () => {
  restoreScrollBehavior()

  const html = document.documentElement
  html.style.scrollBehavior = 'smooth'

  // 他のハンドラに止められてスクロールが一度も起きないと、閉じる手がかりが無くなる
  let backstop = setTimeout(restoreScrollBehavior, FALLBACK_DURATION)
  let debounce = null

  // スクロールが始まれば、終わりは scrollend か途切れで判断できる
  const handleScroll = () => {
    clearTimeout(backstop)

    if (supportsScrollEnd) return

    clearTimeout(debounce)
    debounce = setTimeout(restoreScrollBehavior, SCROLL_END_DELAY)
  }

  window.addEventListener('scroll', handleScroll, { passive: true })

  if (supportsScrollEnd) {
    window.addEventListener('scrollend', restoreScrollBehavior, { passive: true })
  }

  cleanup = () => {
    clearTimeout(backstop)
    clearTimeout(debounce)
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('scrollend', restoreScrollBehavior)
    html.style.scrollBehavior = ''
  }
}

// 遷移そのものはブラウザに任せ、滑らかにするかどうかだけを決める
const handleClick = event => {
  const link = event.target instanceof Element ? event.target.closest('a[href*="#"]') : null

  if (!link || link.getAttribute('data-smooth-scroll') === 'disabled') return

  // ドロワーの開閉やWebフォントの差し替えで高さが変わっているので、直前に測り直す
  updateScrollPadding()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  enableSmoothOnce()
}

export const initialize = () => {
  // ハッシュ付きで開いたときの着地に間に合わせる
  updateScrollPadding()

  // ブレークポイントをまたぐとヘッダーの追従や高さが変わる
  window.addEventListener('resize', updateScrollPadding)

  document.addEventListener('click', handleClick, { capture: true })
}
```

## 使っている仕組み

### 委譲で1つだけ張る

アンカーを1つずつ拾って `addEventListener` しない。`document` に `capture: true` で1つ張り、`closest('a[href*="#"]')` で遡る。あとから差し込んだ要素の中のアンカーも、張り直さずに効く。

`capture: true` にするのは、途中のコンポーネントが `stopPropagation()` していても先に受け取るため。

`event.target` は Element とは限らない。他のスクリプトが `document.dispatchEvent()` で合成クリックを飛ばすと `Document` が入ってくる。`?.` はnullしか守らないので `instanceof Element` で見る。

### 位置合わせは scroll-padding に任せる

止まる位置を `getBoundingClientRect()` と `window.scrollTo()` で自前計算しない。`documentElement` の `scroll-padding-block-start` にヘッダーの高さを入れておけば、ブラウザ自身のフラグメント遷移がその分だけ手前で止まる。

`scroll-padding` はブラウザが持つスクロール位置の基準なので、キーボードのフォーカス移動やハッシュ付きURLでの着地にも同じ値が効く。自前計算だとクリック経由の1経路にしか効かない。

ヘッダーが `fixed` でも `sticky` でもないときは `0` を返す。追従しないヘッダーは要素と一緒に流れるので、ずらす必要がない。

高さを入れ直すのは3か所になる。

| 入れ直す場所 | 間に合わせる状況 |
|---|---|
| `initialize()` | ハッシュ付きURLで開いたときの着地 |
| `resize` | ブレークポイントをまたいでヘッダーの高さや追従の有無が変わったとき |
| `handleClick()` | 画面幅が変わらずに高さだけ変わったとき |

`initialize()` は `DOMContentLoaded` で走るので、ハッシュ付きで開いた最初の着地には間に合わないことがある。ブラウザは移動先の要素を読んだ時点でスクロールを試みる。CSSに既定値を持たせ、JSは実測値で上書きする形にすると取りこぼさない。

```scss
:root {
  scroll-padding-block-start: var(--header-block-size);
}
```

### 滑らかにする窓を開けて閉じる

クリックを受けたら `documentElement` に `scroll-behavior: smooth` を直接書き、スクロールが終わったら消す。滑らかなのはこの窓の中で起きるスクロールだけになる。

終わりの捉え方は、`scrollend` があるかどうかで変える。

| 環境 | 終わりとみなすもの |
|---|---|
| `scrollend` がある | イベントが飛んだ瞬間 |
| `scrollend` が無い | `scroll` が100ms途切れた時点 |

固定の時間で打ち切ってはいけない。アニメーションの最中に `scroll-behavior` を戻すと、スクロールがその場で止まる。実測では2425pxの移動に781msから866msかかっていて、移動距離とページの状態で変わるので、あらかじめ決め打ちできない。`scroll` の途切れを見れば、どれだけ長引いても終わってから戻せる。

これとは別に、上限時間の保険を置く。タブやアコーディオンのように別のハンドラが `preventDefault()` してスクロールが一度も起きなかった場合、`scrollend` も `scroll` も飛ばないので、閉じる手がかりが無くなる。5秒で打ち切る。

保険は最初の `scroll` が来た時点で外す。外さないと、長いスクロールの最中に上限が来て打ち切り、アニメーションがその場で止まる。スクロールが始まったなら終わりは `scrollend` か途切れで分かるので、時間で見張る必要はもう無い。

### 標準に任せたままにするもの

ハッシュの更新、履歴、フォーカス、別ページへの遷移、修飾キー、`target` 指定は全部ブラウザが持つ。こちらは何もしない。

外したいアンカーには `data-smooth-scroll="disabled"` を付ける。滑らかにしないだけで、移動そのものは起きる。

`role="tab"` や `role="button"` を持つアンカーを名指しで外す必要はない。それらは自分のコンポーネントが `preventDefault()` するので移動が起きず、時間で窓が閉じる。そもそも `<a href="#panel">` に `role="tab"` を付けると、リンクのEnter起動をタブの矢印キー操作で上書きすることになる。付けない。

## ページ先頭へ戻すとき

ページトップボタンはアンカーではないので、この委譲には乗らない。`window.scrollTo()` を直接呼ぶ。

```js
const scrollToTop = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  window.scrollTo({ top: 0, behavior: prefersReduced ? 'instant' : 'smooth' })
}
```

`behavior` に `'auto'` を渡すとCSSの `scroll-behavior` を拾ってしまうので、止めたいときは `'instant'` を明示する。

## reset での扱い

`:root` に `scroll-behavior` を書かない。reset 側は `prefers-reduced-motion: reduce` のときに打ち消すだけにする。ライブラリやCMSのテンプレートが `smooth` を入れてくることがあるので、この打ち消しは残す。

```scss
*,
::before,
::after,
::backdrop {
  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: unset !important;
  }
}
```
