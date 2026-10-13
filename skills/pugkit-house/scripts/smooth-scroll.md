# スムーススクロール

アンカーリンクのスクロールは、遷移そのものをブラウザに任せ、滑らかにするかどうかだけをJSで切り替える。CSSに `scroll-behavior: smooth` を常時置かない。`preventDefault()` でブラウザの遷移を止めて自前でスクロールし直すこともしない。

## CSSに常時置かない理由

`scroll-behavior: smooth` を `:root` に書くと、そのスクロールコンテナで起きるCSSOM経由のスクロールが全部滑らかになる。アンカーのジャンプだけを狙って書いても、次のものまで巻き込む。

| 巻き込まれるもの | 起きること |
|---|---|
| ページ内リンクを持つナビを閉じたあとの位置調整 | 合わせ直した位置へ向かってページが流れる |
| フォームのエラー箇所へのフォーカス移動 | 入力に戻るまで待たされる |
| カルーセルやタブが呼ぶ `scrollTo()` | 部品ごとの速さが揃わなくなる |

戻る・進むでのスクロール位置の復元は、静的なMPAでは巻き込まれない。ブラウザ自身の復元は `scroll-behavior` を経由しないので、CSSに書いても即時のままになる。この症状が報告されているのは、フレームワークが `window.scrollTo()` で復元を実装している場合で、そちらはCSSOM経由なので指定を拾う。

滑らかに動かすと、通過する要素の `IntersectionObserver` が順に発火する。ページの上端から下端まで流すと、間にある要素が全部「見えた」ことになる。瞬間ジャンプでは中間が描画されないので発火しない。

## preventDefault しない理由

`preventDefault()` して自前でスクロールすると、ブラウザが持っていた処理を全部やり直すことになる。やり直すと、どこかで漏れが出る。

| 標準が持っていたもの | 止めると失うもの |
|---|---|
| 順次フォーカス始点の移動 | Tabの起点が移動先に移らず、リンクの位置から再開する |
| 修飾キー付きクリック、`target` 指定 | 別タブで開けなくなる |
| 別ページへのハッシュ付きリンク | 移動先のidが手元のページにもあると誤爆する |
| `hidden="until-found"` と `<details>` の自動展開 | 閉じた中のidに飛べなくなる |
| `:target` と `hashchange` | `pushState` に置き換えると両方とも動かなくなる |

順次フォーカス始点は、ブラウザがフラグメント遷移のときにTabの再開位置を移動先へ動かす仕組みになる。標準に任せれば `tabindex="-1"` も `focus()` も要らない。`preventDefault()` した場合だけ、`focus()` で自前で補う必要が出る。補い忘れると、移動先に飛んだつもりでフォーカスだけが手前に取り残される。

## 組み方

`assets/js/_smoothScroll.js` に置き、`initialize()` を公開して `main.js` の `globals` に載せる。ルートになる要素を持たないので `data-module` には載せない。理由は [modules.md](modules.md) にある。

### 初期化

`initialize()` では3つのことをする。

1. ヘッダーの高さを測って `scroll-padding` に入れる
2. `window` の `resize` で、同じ測り直しを呼ぶ
3. `document` に `click` を `capture: true` で1つだけ張る

### ヘッダーの高さを測る

`[data-fixed-header]` を付けた要素をヘッダーとして探す。`getComputedStyle()` の `position` が `fixed` か `sticky` なら、算出値の `blockSize` を高さとして返す。それ以外か、ヘッダーが無いときは `'0'` を返す。返した値を `document.documentElement.style.scrollPaddingBlockStart` に入れる。

### クリックを受けたとき

1. `event.target` が `Element` かを確かめ、`closest('a[href*="#"]')` でアンカーまで遡る。見つからなければ何もしない
2. アンカーに `data-smooth-scroll="disabled"` があれば何もしない
3. ヘッダーの高さを測り直す
4. `prefers-reduced-motion: reduce` に当たれば、ここで抜ける。移動は即時のまま起きる
5. 次のスクロールだけを滑らかにする窓を開ける

`preventDefault()` はどの段階でも呼ばない。

### 窓を開けて閉じる

窓は同時に1つしか持たない。開く前に、前の窓が残っていれば閉じる。閉じる処理は1つの関数にまとめ、モジュールの先頭の変数に持たせる。`globals` に載せるので、[modules.md](modules.md) の「状態は `initialize()` の中に置く」の例外に当たる。

1. `documentElement.style.scrollBehavior` に `smooth` を書く
2. 保険のタイマーを5秒で掛ける。満了したら窓を閉じる
3. `window` の `scroll` を `passive` で受ける。最初の1回で保険のタイマーを外す
4. `scrollend` があるブラウザでは、`scrollend` を受けたら窓を閉じる
5. `scrollend` が無いブラウザでは、`scroll` を受けるたびに100msのタイマーを掛け直し、満了したら窓を閉じる
6. 窓を閉じるときは、2つのタイマーを止め、`scroll` と `scrollend` の受け取りを外し、`scrollBehavior` を空文字に戻す

`scrollend` の有無は `'onscrollend' in window` で見る。

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
| クリックを受けたとき | 画面幅が変わらずに高さだけ変わったとき |

`initialize()` は `DOMContentLoaded` で走るので、ハッシュ付きで開いた最初の着地には間に合わないことがある。ブラウザは移動先の要素を読んだ時点でスクロールを試みる。CSSに既定値を持たせ、JSは実測値で上書きする形にすると取りこぼさない。既定値にはヘッダーの高さのトークンを使う。無ければ `_tokens.scss` に足す。下のトークン名は一例になる。

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
| `scrollend` がある | イベントが飛んだ時点 |
| `scrollend` が無い | `scroll` が100ms途切れた時点 |

固定の時間で打ち切ってはいけない。アニメーションの最中に `scroll-behavior` を戻すと、スクロールがその場で止まる。かかる時間は移動距離とページの状態で数百msの幅で変わるので、あらかじめ決め打ちできない。`scroll` の途切れを見れば、どれだけ長引いても終わってから戻せる。

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
