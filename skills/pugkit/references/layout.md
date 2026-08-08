# 共通レイアウト

共通レイアウト（create-pugkit テンプレートでは `src/_templates/_layout.pug`）が HTML スケルトン・head メタ・ヘッダー・フッターを描画する。ページの追加手順は [new-page.md](new-page.md) を参照。

## レイアウトが用意する block

| block                         | 用途                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `vars`                        | ページ変数（`metaData` など）の定義・上書き                                   |
| `analytics` / `bodyAnalytics` | 計測タグ（head 内 / body 開始直後）                                           |
| `structuredData`              | 構造化データ（JSON-LD）                                                       |
| `externalResources`           | Web フォントなどの外部リソース                                                |
| `styles` / `scripts`          | CSS / JS の読み込み（デフォルトで Sass / JS エントリを `Builder.dir` で参照） |
| `header` / `footer`           | ヘッダー・フッター（デフォルトで `includes/_header` / `_footer` を include）  |
| `contents`                    | ページ本体（`main` 内に出力される）                                           |

- デフォルトに**追記**するときは `block append`（例: ページ固有 CSS は `block append styles`）、**置き換える**ときは `block` で上書きする。

## 派生レイアウトの作り方

同じ追加要素を持つページ群が複数ある場合は、ベースレイアウトを `extends` した派生レイアウトを作って共有する。変数やブロックは `block append` で**上書きせず追記**する。

```pug
//- src/_templates/_pageLayout.pug
extends ./_layout

block append vars
  -
    const pageHeader = { title: '' }

block contents
  //- 下層ページ共通の枠をここに置く
  header.page-header
    h1= pageHeader.title
  //- 各ページの本体はこのブロックに書く
  block pageContents
```

```pug
//- ページ側の使用例: src/service/index.pug
extends /_templates/_pageLayout

block append vars
  -
    metaData.pageTitle = 'サービス'
    pageHeader.title = 'サービス'

block pageContents
  section.service
    p サービスの内容
```

## ベースレイアウトの作成

既存プロジェクトにレイアウトがある場合は、兄弟ページの `extends` 先と block 名に従う。共通レイアウトが無い場合は、テンプレートと同じ block 構成で作成する:

```pug
//- src/_templates/_layout.pug
include /_templates/_constants
include /_templates/mixins/_Meta
include /_templates/mixins/_Image

block vars
  - const metaData = META_DATA

doctype html
html(lang='ja')
  head
    +Meta(metaData)

    //- 計測タグ
    block analytics

    //- 構造化データ
    block structuredData

    //- 外部リソース
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

- include のパスや CSS / JS エントリの場所はプロジェクトの構成に合わせて調整する。
