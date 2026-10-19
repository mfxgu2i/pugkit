# JSのモジュール分割

機能ごとに1ファイルに分け、どの機能が要るかはマークアップ側が名乗る。`main.js` は名前とモジュールの対応表だけを持つ。

## 機能ごとに1ファイル

`assets/js/_名前.js` に置き、`initialize()` を公開する。5つを超えたら `assets/js/modules/` にまとめる。移しても `_` は外さない。`_` で始まらないファイルはビルドが独立したエントリーとして扱うので、モジュール単体が1本のバンドルになる。TypeScriptの案件も同じで、拡張子だけが変わる。

`initialize()` にはJSDocを付ける。受け取るルート要素と、ルートの中で当てにしているクラス名や属性を書く。

1ファイルが受け持つのは1つの機能になる。分けるかどうかは、片方だけを別のページに置きたくなるかで決める。ヘッダーの開閉と追従は同じ要素に付くが、追従だけを使うページがあるなら別のファイルにする。

ページ単位では分けない。トップページ用のファイルを作ると、同じ動きを別ページで使いたくなったときに写すことになる。

## マークアップが機能を名乗る

`data-module` に機能名を書く。ローダーはそれを探して、対応するモジュールを呼ぶ。

```pug
.c-carousel(data-module='carousel')
  .c-carousel__slide …
```

`main.js` はローダーとして、次の順に組む。

1. 各モジュールを静的 import で読む。`import * as carousel from './_carousel'` の形で、モジュールの名前空間ごと受け取る
2. ルートを持つ機能を対応表 `registry` に、ルートを持たない機能を `globals` に載せる。`registry` は `Object.assign(Object.create(null), { … })` で作る。プロトタイプを持たせると、`data-module="constructor"` のような属性値で `Object` の関数を引いてしまう
3. 1つのモジュールを初期化する関数 `run(name, module, element)` を作る。`module.initialize(element)` を `try` で囲み、例外は `console.error(name, error)` に流す。戻り値が `Promise` なら、その `catch` でも同じく流す。非同期の `initialize()` は、失敗が `try` の外で起きる
4. `start()` で、先に `globals` を全部 `run()` し、次に `document.querySelectorAll('[data-module]')` を順に見る。属性値を空白で分け、名前ごとに `registry` から引いて `run()` に要素ごと渡す。引けなかった名前は `console.error` に出して次へ進む
5. `document.readyState` が `loading` なら `DOMContentLoaded` で `start()` を呼び、そうでなければすぐ呼ぶ。`type="module"` は既定で解析後に走るが、読み込み方を変えた案件では登録より先に解析が終わっていることがある

```js
import * as carousel from './_carousel'
import * as pageTop from './_pageTop'
import * as smoothScroll from './_smoothScroll'

const registry = Object.assign(Object.create(null), {
  carousel,
  'page-top': pageTop
})

const globals = { smoothScroll }
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
header.l-header(data-module='drawer sticky-header')
```

開閉や切り替えのある UI をどのモジュールに分けるかは、`ui/` の各ファイルに書いてある。`details` で組むアコーディオンのように、JS を持たず `data-module` にも載らないものがある。

## 設定値は別の属性で渡す

機能名に値を混ぜない。`data-module="carousel-3"` と書くと、対応表のキーが値の数だけ増える。値は別の `data-*` に持たせ、モジュールがルートから読む。

```pug
.c-carousel(data-module='carousel' data-slides-per-view='3')
```

属性名の付け方は [design/state.md](../design/state.md) にそろえる。CSSからも見たい値なら、そのまま `[data-slides-per-view='3']` で分岐できる。

比較する相手のセレクタも、この形で渡す。追従ボタンとフッターの重なりを見るような、位置の判定にページの他の場所が要る機能が該当する。

```pug
.c-page-top-button(data-module='page-top' data-page-top-boundary='footer.l-footer')
```

どのマークアップに依存しているかがマークアップ側に出るので、`document` を無条件に検索するのとは別扱いにする。

## モジュールは自分のルートを受け取る

`initialize(root)` はルート要素を引数で受け取る。

```js
export const initialize = root => {
  const slides = root.querySelectorAll('.c-carousel__slide')
  if (!slides.length) return

  // …
}
```

ルートは、そのモジュールが触る要素をすべて含む一番内側の要素に取る。`root.closest()` で上に登りたくなったら、登った先が本当のルートになる。`data-module` をそちらに移す。

ルートの中を探すときも `document` を使わない。id で結ばれた要素も `root.querySelector('#' + id)` で引ける。

`aria-controls` や `commandfor` のように、id でルートの外の相手を指す属性は例外にする。この2つはHTMLが結び先を宣言しているので、`document.getElementById()` で引いてよい。引いてよいのは属性値が指す1つだけで、そこから `document` を再検索しない。

前の節で渡した `data-*` のセレクタも同じ扱いになる。`document.querySelectorAll()` で引いてよい。どちらも、どこを見ているかがマークアップに出ていることが条件になる。書いていないセレクタで `document` を探さない。

状態は `initialize()` の中に置く。ファイルの先頭に `let` で要素やタイマーやオブザーバーを持たせない。要素ごとに `initialize()` が走るので、モジュールレベルに置くと後から初期化した要素で上書きされる。同じ機能を2箇所に置いたとき、最後の1つしか動かなくなる。

`globals` に載せたものはこの規則の例外になる。ページに1回しか `initialize()` が走らないので、上書きされる相手がいない。ページ全体で1つしか持たない状態は、モジュールの先頭に置いてよい。

ルートを受け取ることで3つ変わる。

| 変わること | 理由 |
|---|---|
| ルートの有無を確かめる定型が消える | 見つかった要素だけを渡すので、無いときは呼ばれない |
| 同じ機能を1ページに複数置ける | 要素ごとに `initialize()` が走る |
| どのマークアップに依存しているかが引数に出る | `document.querySelector` を追わなくても読める |

ルートの中の要素を確かめる分岐は残る。消えるのはルートそのものを探す部分だけになる。

## ページ全体に効くものは名乗らせない

ルートになる要素を持たない機能がある。アンカーリンクのスクロールのように `document` に委譲を張るもの、ヘッダーとメインビジュアルのように離れた2要素を突き合わせるもの、ページ内の全画像を差し替えるものが該当する。アンカーリンクのスクロールの組み方は [smooth-scroll.md](smooth-scroll.md) にある。

| ルートになる要素 | 呼び方 |
|---|---|
| ある | `data-module` で名乗らせる |
| 無い | `globals` に載せる |

ルートを持つかどうかで分ける。委譲を張るかどうかでは分けない。無理にルートをこじつけて `body` に `data-module` を付けない。

## 失敗を1つの要素に閉じる

`try` はモジュールごと、要素ごとに置く。全体を1つの `try` で囲まない。

囲むと、最初に例外を投げたモジュールから先が初期化されない。たとえばカルーセルの不具合で、ヘッダーの開閉が動かなくなる。原因のモジュールと動かなくなった場所が離れるので、調べるのにも時間がかかる。

`console.error` が残るのは開発ビルドだけになる。本番ビルドは `console` を落とすので、登録漏れも例外も画面には何も出ない。壊れた機能を切り離すのが目的で、本番で知らせるのが目的ではない。本番でも記録が要る案件では、`console.error` を計測側へ送る関数に置き換える。

## 一度きりで走ることを前提にする

ローダーが走るのは1回だけで、`document.querySelectorAll()` が返すのはその時点の一覧になる。あとから差し込んだ要素は `data-module` を書いても呼ばれない。差し込んだ側が対象のモジュールを import して `initialize()` を呼ぶ。

入れ子にした場合は、`querySelectorAll` の順で外側から `initialize()` が走る。内側の初期化が済んでいることを外側が当てにしない。

## 動的 import で分けない

`import()` で遅延読み込みしたくなるが、静的 import で書く。

pugkit のビルドは `splitting: false` で動く。esbuild は動的 import を別ファイルに切り出さず、`Promise.resolve()` に書き換えて同じバンドルにまとめる。読み込むバイト数は変わらないまま、非同期の扱いと `__esm` のヘルパーだけが増える。分けたつもりで、増えるだけになる。

このルールが成り立つのは `splitting: false` の間だけになる。ビルド設定が変わったらこの節を見直す。

ページごとに読む量を絞りたいなら、バンドルを分けるのではなくエントリーポイントを分ける。pugkit は `_` で始まらない `.js` と `.ts` をそれぞれエントリーとして扱うので、ファイルを1枚足せば別のバンドルになる。
