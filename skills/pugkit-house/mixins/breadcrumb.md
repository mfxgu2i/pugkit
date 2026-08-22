# +Breadcrumb

用途はパンくずリストと `BreadcrumbList` 構造化データを出力すること。可視のマークアップとJSON-LDを同じ引数から組み立てる。派生レイアウトから呼ぶ。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` `Builder.url.base` `Builder.url.href` | pugkit が提供するグローバル |
| `metaData` | ベースレイアウトの `block vars` |
| `breadcrumb` | 派生レイアウト `_pageLayout.pug` の `block append vars` |

## mixin

```pug
mixin Breadcrumb(breadcrumb = {})
  -
    const middlePages = breadcrumb.middlePages || []
    const pageTitle = breadcrumb.pageTitle || metaData.pageTitle

    const normalizePath = (value) => {
      const trimmed = String(value).replace(/^\/+/, '').replace(/\/+$/, '')

      if (!trimmed) return ''

      return /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}/`
    }

    const trail = [{label: 'ホーム', path: ''}].concat(
      middlePages.map((item) => ({label: item.label, path: normalizePath(item.path)}))
    )

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail
        .map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          item: `${Builder.url.base}/${item.path}`
        }))
        .concat([{
          '@type': 'ListItem',
          position: trail.length + 1,
          name: pageTitle,
          item: Builder.url.href
        }])
    }

  nav.c-breadcrumb(aria-label='パンくずリスト')
    ol.c-breadcrumb__list
      each item in trail
        li.c-breadcrumb__item
          a.c-breadcrumb__link(href=`${Builder.dir}${item.path}`)= item.label
      li.c-breadcrumb__item(aria-current='page')= pageTitle

  script(type='application/ld+json')
    != JSON.stringify(jsonLd, null, 2)
```

内側にコンテナを挟む場合は `nav` の直下に1階層足し、そこにコンテナのクラスを付ける。mixin 側にクラス名を書かない。幅もクラス名もユーティリティ側が持つ。

## 引数

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `breadcrumb.middlePages` | object[] | `[]` | トップと現在地の間の中間ページ。順に並べる |
| `breadcrumb.middlePages[].label` | string | なし | 表示名 |
| `breadcrumb.middlePages[].path` | string | なし | ルートからのパス |
| `breadcrumb.pageTitle` | string | `metaData.pageTitle` | パンくずに出す現在ページ名 |

トップと現在地は mixin が足すので、渡すのは中間だけになる。`pageTitle` は title と違う文言をパンくずに出したいときだけ設定する。

`path` は先頭スラッシュを落として末尾スラッシュを補うので、`company/` でも `/company/` でも `company` でも同じ結果になる。正規化しないと `/company/` が `..//company/` になり、`company` は canonical と一致しない URL が構造化データに入る。どちらもビルドは通ってしまう。

## 呼び出し

派生レイアウトが `block append vars` で `breadcrumb` を宣言し、`block contents` で呼ぶ。

```pug
extends ./_layout

include /_templates/mixins/_Breadcrumb

block append vars
  -
    const breadcrumb = {
      middlePages: [],
      pageTitle: ''
    }

block contents
  +Breadcrumb(breadcrumb)

  block pageContents
```

ページ側は中間階層があるときだけ書き足す。

```pug
block append vars
  -
    metaData.pageTitle = '沿革'
    breadcrumb.middlePages = [{label: '会社案内', path: 'company/'}]
```

## SCSS

この mixin 自体は見た目を持たない。`components/_breadcrumb.scss` を作って当てる。

区切り記号は `::before` などで描く。`&gt;` や `/` を文字として書くと読み上げに混ざる。

## やってはいけないこと

可視のマークアップとJSON-LDを別のmixinに分けない。構造化データは可視のパンくずと階層も表示名も一致している必要がある。分けると、中間階層を1つ足したときに片方だけ直す事故が起きる。

現在地をリンクにしない。`aria-current="page"` を付けたテキストで出す。

トップページからは呼ばない。ベースレイアウトを直接継承させれば、パンくずも構造化データも出ない。