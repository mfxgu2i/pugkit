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

## block の名前

| block | 中身 |
|---|---|
| `vars` | ページ定数の宣言 |
| `analytics` | head 内の計測タグ |
| `structuredData` | 構造化データ |
| `externalResources` | 外部フォントなど |
| `styles` | CSSの読み込み |
| `scripts` | JSの読み込み |
| `bodyAnalytics` | body 直後の noscript 計測タグ |
| `header` | ヘッダー |
| `contents` | main の中身 |
| `footer` | フッター |

全ページで使う mixin の `include` はベースレイアウトの先頭にまとめる。そのレイアウトでしか使わない mixin は、使う派生レイアウトの `extends` の直後で include する。ページごとには include しない。

```pug
include /_templates/_constants
include /_templates/mixins/_Meta
include /_templates/mixins/_Image
include /_templates/mixins/_Wrapper

block vars
  - const metaData = META_DATA

doctype html
html(lang='ja')
  head
    +Meta(metaData)
    block analytics
    block structuredData
    block externalResources
    block styles
      link(rel='stylesheet' href=`${Builder.dir}assets/css/style.css`)
    block scripts
      script(src=`${Builder.dir}assets/js/main.js` type='module')
  body
    block bodyAnalytics
    block header
      include /_templates/includes/_header
    main
      block contents
    block footer
      include /_templates/includes/_footer
```

`main` の中身は `+Wrapper()` を縦に並べて組み立てる。`main` 自体にはクラスを付けない。積み上げ方は [../mixins/wrapper.md](../mixins/wrapper.md) を参照。

## ページ定数は block append vars で渡す

派生レイアウトとページは `block append vars` でページ固有の定数を宣言する。`block vars` を上書きするとベース側の宣言が消えるので、必ず `append` を使う。

```pug
extends ./_layout

//- この派生レイアウトでしか使わない mixin
include /_templates/mixins/_Breadcrumb

block append vars
  -
    const breadcrumb = {
      middlePages: [],
      pageTitle: ''
    }

    const pageHeader = {
      label: '',
      description: '',
      image: ''
    }
```

派生レイアウトが持つのは枠と既定値で、ページは値だけを上書きする。ページヘッダーの見出しや背景画像のように、ページごとに中身は変わるが構造は変わらないものは、この形で渡す。ページ側にマークアップを書かせると、同じ枠が種別の数だけ複製される。

派生レイアウト側で `block contents` を実装し、その中にページが書き込むための `block pageContents` を切る。こうするとページ共通の枠を派生側が持ち、ページは中身だけを書く。

```pug
block contents
  +Breadcrumb(breadcrumb)

  block pageContents

  include /_templates/includes/_contact
```
## 定数ファイル

サイト共通の定数は `_templates/_constants.pug` に置く。サイト名とディスクリプション、ブレークポイントの定義がここに入る。全ページで使う小さなヘルパー関数も、置くならここにまとめる。

```pug
-
  const META_DATA = {
    siteTitle: '',
    siteDescription: '',
    pageTitle: '',
    pageDescription: '',
    pageType: 'article'
  }

  const BREAK_POINTS = {
    sm: '(max-width: 575.98px)',
    md: '(max-width: 767.98px)',
    lg: '(max-width: 889.98px)',
  }
```

一覧データの置き場は、引く側の数で決める。カードやインタビュー記事のような配列は、複数のページから引くなら `_constants.pug`、1ページで閉じるならそのページの `block append vars` に置く。1ページ分のデータを共通ファイルに置くと、全ページのテンプレートがその配列を抱えたままになり、どこから参照されているかも追えなくなる。

## ページを1枚足す手順

1. どのレイアウトを継承するか決める。トップと、パンくずを出さないページはベースレイアウト、それ以外は派生レイアウト
2. `src/` にディレクトリを作り `index.pug` を置く。ディレクトリ構成がそのまま URL になる
3. `block append vars` で `metaData.pageTitle` と `metaData.pageDescription` を設定する。設定を忘れるとトップと同じタイトルが出る
4. 中間階層があれば `breadcrumb.middlePages` を設定する
5. `block pageContents` に `+Wrapper()` を積み上げる
6. ナビゲーションに載せるなら `_templates/_constants.pug` の `GLOBAL_NAV` と `FOOTER_NAV` に追記する
7. `pugkit build && pugkit check` を実行する。`check` は出力 HTML の参照切れを見るので、リンク先を先に作っておく