# ハンバーガーメニューとドロップダウン

APG の [Disclosure Navigation Menu](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) を写す。ハンバーガーで開くナビも、PC のドロップダウンとメガメニューも同じパターンになる。開閉する領域を持つ標準要素は無い。`dialog` は閉じている間 `display: none` になり、PC で常時表示するナビと同じマークアップを使えないので採らない。

`role="menu"` と `role="menuitem"` を付けない。APG の Menu はアプリケーションのコマンドの一覧で、ページへのリンクの一覧はその対象ではない。

## マークアップと置き場

```pug
header.l-header(
  data-module='drawer'
  data-drawer-media=BREAK_POINTS.md
  data-drawer-inert='main, footer'
)
  button.l-header__toggle(type='button' aria-expanded='false' aria-controls='global-nav')
  nav#global-nav.l-header__nav(aria-label='グローバル')
```

マークアップは `_templates/includes/_header.pug`、SCSS は `layouts/_header.scss`、JS は `assets/js/_drawer.js`。ヘッダーの骨格なので、他の部品と違って layouts に置く。層の決め方は [../design/flocss.md](../design/flocss.md) にある。

JS が書き換えるのは `aria-expanded` と、`data-drawer-inert` が指す要素の `inert` の2つ。見た目は CSS が `:has([aria-expanded='true'])` から引く。初期の `aria-expanded='false'` はマークアップが持つ。分担の規則は [../design/state.md](../design/state.md)、`data-*` でセレクタを渡す形は [../scripts/modules.md](../scripts/modules.md) にある。

ドロップダウンを複数持つナビでは、トグルとパネルの組ごとに `aria-controls` の id を変える。

## 覆うかどうか

| | 背後のスクロール | 背後の操作 |
|---|---|---|
| 画面を覆う SP のドロワー | 止める | `inert` で止める |
| ヘッダーの下に開くナビ、PC のドロップダウンとメガメニュー | できてよい | 触れてよい |

覆うなら `data-drawer-inert` を書き、覆わないなら書かない。APG の Disclosure Navigation Menu は、Tab がナビの外へ出られることを前提に書かれている。覆わないものを止めると、マウスの利用者は無視して先へ進めるのに、キーボードと支援技術の利用者だけが Escape を押すまで抜けられなくなる。メガメニューでスクロールを奪うのも、下へ読み進めようとする操作と競合する。止め方は [scroll-lock.md](scroll-lock.md) にある。

## 実装で外しやすいところ

Escape は `document` に張る。ナビの余白を押すとフォーカスが `body` に落ちるので、ヘッダーに張ると届かない。閉じたらボタンへフォーカスを戻す。

閉じている間は `visibility: hidden` で隠す。`display: none` にすると `opacity` と `translate` の遷移が付かない。時間は `--duration-normal` から取る。

覆うナビには背景色と `overflow-y` を持たせ、トグルボタンをナビより前の重なりに出す。ヘッダー自体の重なりは `--z-header` を使う。無いと背後が透け、項目が画面高を超えると下へ届かず、開いた瞬間にボタンが押せなくなる。

`data-drawer-media` には SP 側のメディアクエリを渡す。`matches` が偽になったら閉じる。閉じないと `inert` が残り、PC 幅でページ全体が操作できなくなる。値は SCSS の `$grid-breakpoints` と境界を揃える。
