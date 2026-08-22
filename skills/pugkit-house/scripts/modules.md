# JSのモジュール分割

機能ごとに1ファイルに分け、どの機能が要るかはマークアップ側が名乗る。`main.js` は名前とモジュールの対応表だけを持つ。

## 機能ごとに1ファイル

`assets/js/_名前.js` に置き、`initialize()` を公開する。5つを超えたら `assets/js/modules/` にまとめる。移しても `_` は外さない。`_` で始まらないファイルはビルドが独立したエントリーとして扱うので、モジュール単体が1本のバンドルになる。TypeScriptの案件も同じで、拡張子だけが変わる。

`initialize()` にはJSDocを付ける。受け取る根の要素と、根の中で当てにしているクラス名を書く。

1ファイルが受け持つのは1つの機能になる。分けるかどうかは、片方だけを別のページに置きたくなるかで決める。ヘッダーの開閉と追従は同じ要素に付くが、追従だけを使うページがあるなら別のファイルにする。

ページ単位では分けない。トップページ用のファイルを作ると、同じ動きを別ページで使いたくなったときに写すことになる。

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
import * as smoothScroll from './_smoothScroll'

// 根を持つ機能。マークアップが data-module で名乗る
// プロトタイプを持たせない。registry['constructor'] が関数を返すのを防ぐ
const registry = Object.assign(Object.create(null), {
  carousel,
  tabs,
  'page-top': pageTop
})

// 根を持たない機能。名前で引けるようにしておく
const globals = { smoothScroll }

const run = (name, module, element) => {
  try {
    const result = module.initialize(element)
    // 非同期の initialize は、返ってきた Promise の失敗も拾う
    if (result instanceof Promise) result.catch(error => console.error(name, error))
  } catch (error) {
    console.error(name, error)
  }
}

const start = () => {
  for (const [name, module] of Object.entries(globals)) {
    run(name, module)
  }

  document.querySelectorAll('[data-module]').forEach(element => {
    for (const name of element.dataset.module.split(/\s+/).filter(Boolean)) {
      const module = registry[name]

      if (!module) {
        console.error(`data-module="${name}" に対応するモジュールが無い`)
        continue
      }

      run(name, module, element)
    }
  })
}

// スクリプトの読み込み方を変えた案件では、登録より先に解析が終わっていることがある
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start)
} else {
  start()
}
```

名前は4か所に現れる。書き分けを固定する。

| 現れる場所 | 記法 | 例 |
|---|---|---|
| `data-module` の属性値 | kebab-case | `page-top` |
| 対応表のキー | 属性値と一字一句同じ | `'page-top'` |
| ファイル名 | `_` + lowerCamelCase | `_pageTop.js` |
| import 名 | lowerCamelCase | `pageTop` |

`element.dataset.module` は属性値をそのまま返すので、属性値とキーがずれると登録漏れになる。1語ならどれも同じ綴りになるので、対応表は `carousel,` とだけ書ける。

1つの要素に複数の機能を持たせたいときは、空白で区切って並べる。ローダーは書いた順に呼ぶ。包むだけの要素を足さずに済む。

```pug
.c-floating-navigation(data-module='floating-navigation-offset floating-navigation-visibility')
```

## 設定値は別の属性で渡す

機能名に値を混ぜない。`data-module="carousel-3"` と書くと、対応表のキーが値の数だけ増える。値は別の `data-*` に持たせ、モジュールが根から読む。

```pug
.c-carousel(data-module='carousel' data-slides-per-view='3')
```

属性名の付け方は [design/state.md](../design/state.md) にそろえる。CSSからも見たい値なら、そのまま `[data-slides-per-view='3']` で分岐できる。

比較する相手のセレクタも、この形で渡す。追従ボタンとフッターの重なりを見るような、位置の判定にページの他の場所が要る機能が該当する。

```pug
.c-page-top-button(data-module='page-top' data-page-top-boundary='footer.c-wrapper')
```

どのマークアップに寄りかかっているかがマークアップ側に出るので、`document` を無条件に検索するのとは別扱いにする。

## モジュールは自分の根を受け取る

`initialize(root)` は根の要素を引数で受け取る。

```js
export const initialize = root => {
  const slides = root.querySelectorAll('.c-carousel__slide')
  if (!slides.length) return

  // …
}
```

根は、そのモジュールが触る要素をすべて含む一番内側の要素に取る。`root.closest()` で上に登りたくなったら、登った先が本当の根になる。`data-module` をそちらに移す。

根の中を探すときも `document` を使わない。id で結ばれた要素も `root.querySelector('#' + id)` で引ける。

`aria-controls` や `commandfor` のように、id で根の外の相手を指す属性は例外にする。この2つはHTMLが結び先を宣言しているので、`document.getElementById()` で引いてよい。引いてよいのは属性値が指す1つだけで、そこから `document` を再検索しない。

状態は `initialize()` の中に置く。ファイルの先頭に `let` で要素やタイマーやオブザーバーを持たせない。要素ごとに `initialize()` が走るので、モジュールレベルに置くと後から初期化した要素で上書きされる。同じ機能を2箇所に置いたとき、最後の1つしか動かなくなる。

根を受け取ることで3つ変わる。

| 変わること | 理由 |
|---|---|
| 根の有無を確かめる定型が消える | 見つかった要素だけを渡すので、無いときは呼ばれない |
| 同じ機能を1ページに複数置ける | 要素ごとに `initialize()` が走る |
| どのマークアップに依存しているかが引数に出る | `document.querySelector` を追わなくても読める |

根の中の要素を確かめる分岐は残る。消えるのは根そのものを探す部分だけになる。

## ページ全体に効くものは名乗らせない

根になる要素を持たない機能がある。アンカーリンクのスクロールのように `document` に委譲を張るもの、ヘッダーとメインビジュアルのように離れた2要素を突き合わせるもの、ページ内の全画像を差し替えるものが該当する。実装は [smooth-scroll.md](smooth-scroll.md) にある。

| 根になる要素 | 呼び方 |
|---|---|
| ある | `data-module` で名乗らせる |
| 無い | `globals` に載せる |

根を持つかどうかで分ける。委譲を張るかどうかでは分けない。無理に根をこじつけて `body` に `data-module` を付けない。

## 失敗を1つの要素に閉じる

`try` はモジュールごと、要素ごとに置く。全体を1つの `try` で囲まない。

囲むと、最初に例外を投げたモジュールから先が初期化されない。カルーセルの不具合でヘッダーの開閉が死ぬ、という壊れ方をする。原因のモジュールと壊れた場所が離れるので、調べるのにも時間がかかる。

`console.error` が残るのは開発ビルドだけになる。本番ビルドは `console` を落とすので、登録漏れも例外も画面には何も出ない。壊れた機能を切り離すのが目的で、本番で知らせるのが目的ではない。本番でも記録が要る案件では、`console.error` を計測側へ送る関数に置き換える。

## 一度きりで走ることを前提にする

ローダーが走るのは1回だけで、`document.querySelectorAll()` が返すのはその時点の一覧になる。あとから挿した要素は `data-module` を書いても呼ばれない。挿した側が対象のモジュールを import して `initialize()` を呼ぶ。

入れ子にした場合は、`querySelectorAll` の順で外側から `initialize()` が走る。内側の初期化が済んでいることを外側が当てにしない。

## 動的 import で分けない

`import()` で遅延読み込みしたくなるが、静的 import で書く。

pugkit のビルドは `splitting: false` で動く。esbuild は動的 import を別ファイルに切り出さず、`Promise.resolve()` に書き換えて同じバンドルに畳む。読み込むバイト数は変わらないまま、非同期の扱いと `__esm` のヘルパーだけが増える。分けたつもりで、増えるだけになる。

このルールが成り立つのは `splitting: false` の間だけになる。ビルド設定が変わったらこの節を見直す。

ページごとに読む量を絞りたいなら、バンドルを分けるのではなくエントリーポイントを分ける。pugkit は `_` で始まらない `.js` と `.ts` をそれぞれエントリーとして扱うので、ファイルを1枚足せば別のバンドルになる。
