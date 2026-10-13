# レイアウトの型

## 二段構え

ベースレイアウト `_templates/_layout.pug` が全ページ共通の骨格を持ち、ページ種別ごとの派生レイアウトがそれを `extends` する。ページファイルは派生レイアウトを `extends` する。

```
_layout.pug          共通の骨格
  └─ _pageLayout.pug   下層ページ共通のヘッダーとパンくず
       └─ 各ページの index.pug
```

派生を作らず全ページが直接 `_layout.pug` を継承する構成もある。ページ種別が1つしかないキャンペーンサイトはそれでよい。

派生は横に並ぶ。サービス紹介・規約・一覧のようにページヘッダーの作りが違えば、その数だけ派生を作る。増えても段は2段のままにする。派生から派生を伸ばすと、どの block がどこで実装済みかを追うのに全段を開くことになる。3つを超えたら `_templates/layouts/` にまとめる。

```
_layout.pug
├─ _pageLayout.pug          パンくず付きの下層ページ
├─ _servicePageLayout.pug   サービス紹介ページ
└─ _policyPageLayout.pug    規約ページ
```

## ベースレイアウトの骨格

ベースレイアウトは、先頭で定数ファイルと全ページで使う mixin を include し、`block vars` で `const metaData = META_DATA` を宣言する。`head` の先頭で `+Meta(metaData)` を呼び、`body` に `header`、`main`、`footer` を並べる。ヘッダーとフッターは `_templates/includes/` に分けて include する。

block は次の名前で切る。

| block | 中身 |
|---|---|
| `vars` | ページ定数の宣言 |
| `analytics` | head 内の計測タグ |
| `structuredData` | 構造化データ |
| `externalResources` | 外部フォントなど |
| `styles` | CSSの読み込み。既定で `style.css` を読む |
| `scripts` | JSの読み込み。既定で `main.js` を `type='module'` で読む |
| `bodyAnalytics` | body 直後の noscript 計測タグ |
| `header` | ヘッダー |
| `contents` | main の中身 |
| `footer` | フッター |

`main` は block の外に置き、`block contents` だけを中に入れる。`main` にクラスを付けない。幅も背景も上下余白もセクション側が持つので、`main` に持たせるものがない。

全ページで使う mixin の `include` はベースレイアウトの先頭にまとめる。そのレイアウトでしか使わない mixin は、使う派生レイアウトの `extends` の直後で include する。ページごとには include しない。

## ページ定数は block append vars で渡す

派生レイアウトとページは `block append vars` でページ固有の定数を宣言する。`block vars` を上書きするとベース側の宣言が消えるので、必ず `append` を使う。

```pug
extends /_templates/_layout

include /_templates/mixins/_Breadcrumb

block append vars
  -
    const breadcrumb = {
      middlePages: [],
      pageTitle: ''
    }
```

派生レイアウトが持つのは枠と既定値で、ページは値だけを上書きする。ページヘッダーの見出しや背景画像のように、ページごとに中身は変わるが構造は変わらないものは、この形で渡す。ページ側にマークアップを書かせると、同じ枠が種別の数だけ複製される。

派生レイアウト側で `block contents` を実装し、その中にページが書き込むための `block pageContents` を切る。こうするとページ共通の枠を派生側が持ち、ページは中身だけを書く。

```pug
block contents
  .u-container
    +Breadcrumb(breadcrumb)

  block pageContents
```

## セクションの幅と余白

セクションの寸法は、セクションの `.p-*` と、その直下に置く `.u-container` で分けて持つ。

| 持つもの | 持たせる先 |
|---|---|
| 上下の余白と背景色 | セクションの `.p-*` |
| 内側の最大幅と左右の余白 | `.u-container` |
| 装飾の線や図形 | セクションの `::before` と `::after` |

セクションに `max-inline-size` を書かず、`__inner` のような幅のための要素も作らない。幅の決め方がセクションごとに散る。

`.u-container` は `utilities/_container.scss` に置き、`box-sizing: content-box` にする。最大幅は余白を含まない中身の幅になり、カンプのコンテンツ幅をそのままトークンに書ける。最大幅と余白の値はトークンから取る。名前は `_tokens.scss` を開いて確かめる。推測で書いた名前は未定義の `var()` になり、エラーも出ずに幅の制限が消える。

`.u-container` を入れ子にしない。`padding-inline` が左右に二度足される。同じ要素に別のクラスを付けるのはよいが、そのクラスで `max-inline-size` と `padding-inline` を上書きしない。幅を変えたいときは別のユーティリティを作って差し替える。

ヘッダーとフッターは外側の余白を持たない。最後のセクションとフッターの間は、セクションの上下余白で空ける。フッターに `margin-block-start` を持たせると、背景色のあるセクションで終わるページだけ隙間が白く空く。

装飾は子要素として出力しない。マークアップにデザイン都合の空要素が増える。

### 写真を背景に敷く

写真の背景は `background-image` にせず、`+Image` で出力した `picture` をセクションの子に置き、絶対配置で背面に重ねる。`background-image` では `imageInfo()` の srcset も、アートディレクションも、`fetchpriority` も効かない。ファーストビューの背景なら LCP がそのまま遅れる。

セクションに `isolation: isolate` を付ける。無いと `z-index: -1` の画像がセクションの背景色より後ろに回って見えなくなる。背景の写真は内容を伝えないので `alt` は空にする。

## 定数ファイル

サイト共通の定数は `_templates/_constants.pug` に置く。サイト名とディスクリプション、言語を持つ `META_DATA` と、ブレークポイントの定義 `BREAK_POINTS` がここに入る。全ページで使う小さなヘルパー関数も、置くならここにまとめる。

`BREAK_POINTS` はキーごとに `'(width < 768px)'` のようなメディアクエリの文字列を持つ。値は SCSS の `$grid-breakpoints` と揃える。理由は [breakpoints.md](breakpoints.md) にある。

一覧データの置き場は、引く側の数で決める。カードやインタビュー記事のような配列は、複数のページから引くなら `_constants.pug`、1ページで閉じるならそのページの `block append vars` に置く。1ページ分のデータを共通ファイルに置くと、全ページのテンプレートがその配列を抱えたままになり、どこから参照されているかも追えなくなる。

## ページを1枚足す手順

1. どのレイアウトを継承するか決める。トップと、パンくずを出さないページはベースレイアウト、それ以外は派生レイアウト
2. `src/` にディレクトリを作り `index.pug` を置く。ディレクトリ構成がそのまま URL になる
3. `block append vars` で `metaData.pageTitle` と `metaData.pageDescription` を設定する。設定を忘れるとトップと同じタイトルが出る
4. 中間階層があれば `breadcrumb.middlePages` を設定する
5. `block pageContents` にセクションを並べる
6. ナビゲーションに載せるなら、ヘッダーとフッターの該当箇所にリンクを足す
7. `pugkit build && pugkit check` を実行する。`check` は出力 HTML の参照切れを見るので、リンク先を先に作っておく
