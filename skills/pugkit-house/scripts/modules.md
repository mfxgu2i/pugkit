# JSのモジュール分割

機能ごとに1ファイルに分け、どの機能が要るかはマークアップ側が名乗る。`main.js` は名前とモジュールの対応表だけを持つ。

## 機能ごとに1ファイル

`assets/js/_名前.js` に置き、`initialize()` を公開する。ファイル数が増えたら `modules/` にまとめる。

1ファイルが受け持つのは1つの機能になる。カルーセルとタブを同じファイルに入れない。ページ単位でも分けない。トップページ用のファイルを作ると、同じ動きを別ページで使いたくなったときに写すことになる。

## マークアップが機能を名乗る

`data-module` に機能名を書く。ローダーはそれを探して、対応するモジュールを呼ぶ。

```pug
.c-carousel(data-module='carousel')
  .c-carousel__slide …
```

```js
import * as carousel from './_carousel'
import * as tabs from './_tabs'
import * as pageTop from './_pageTop'

const registry = {
  carousel,
  tabs,
  'page-top': pageTop
}

const start = () => {
  document.querySelectorAll('[data-module]').forEach(element => {
    const name = element.dataset.module
    const module = registry[name]

    if (!module) {
      console.error(`data-module="${name}" に対応するモジュールが無い`)
      return
    }

    try {
      module.initialize(element)
    } catch (error) {
      console.error(name, error)
    }
  })
}

document.addEventListener('DOMContentLoaded', start)
```

機能名は属性値とキーを一字一句そろえる。複数語はケバブケースで書く。`element.dataset.module` は属性値をそのまま返すので、`data-module="page-top"` なら `registry['page-top']` になる。

`data-module` は動きを結びつけるための属性で、開閉やカレントを持たせる `aria-*` や `data-*` とは役割が違う。状態の持たせ方は [design/state.md](../design/state.md) にある。

## モジュールは自分の根を受け取る

`initialize(root)` は根の要素を引数で受け取る。モジュールの中から `document` を検索しない。

```js
export const initialize = root => {
  const slides = root.querySelectorAll('.c-carousel__slide')
  if (!slides.length) return

  // …
}
```

これで3つ変わる。

| 変わること | 理由 |
|---|---|
| 要素の有無を確かめる定型が消える | 見つかった要素だけを渡すので、無いときは呼ばれない |
| 同じ機能を1ページに複数置ける | 要素ごとに `initialize()` が走る |
| どのマークアップに依存しているかが引数に出る | `document.querySelector` を追わなくても読める |

根の外にある要素を触りたくなったら、設計を疑う。ヘッダーの高さのように本当にページ全体の情報なら、次の節の扱いにする。

## ページ全体に効くものは名乗らせない

アンカーリンクのスクロールのように、根になる要素を持たない機能がある。`document` に委譲を1つ張るだけのものが該当する。これらは `data-module` に載せず、`main.js` から直接呼ぶ。

```js
import * as smoothScroll from './_smoothScroll'

const globals = [smoothScroll]

const start = () => {
  for (const module of globals) {
    try {
      module.initialize()
    } catch (error) {
      console.error(error)
    }
  }

  document.querySelectorAll('[data-module]').forEach(element => {
    // …
  })
}
```

無理に根をこじつけて `body` に `data-module` を付けない。根を持つかどうかが、そのまま2つの分かれ目になる。

## 失敗を1つの要素に閉じる

`try` はモジュールごと、要素ごとに置く。全体を1つの `try` で囲まない。

囲むと、最初に例外を投げたモジュールから先が初期化されない。カルーセルの不具合でヘッダーの開閉が死ぬ、という壊れ方をする。原因のモジュールと壊れた場所が離れるので、調べるのにも時間がかかる。

## 動的 import で分けない

`import()` で遅延読み込みしたくなるが、pugkit のビルドは `splitting: false` で動く。esbuild は動的 import を別ファイルに切り出さず、`Promise.resolve()` に書き換えて同じバンドルに畳む。読み込むバイト数は変わらないまま、非同期の扱いと `__esm` のヘルパーだけが増える。

静的 import で書く。ページごとに読む量を絞りたくなったら、バンドルを分ける前にエントリーポイントを分けるほうが先になる。
