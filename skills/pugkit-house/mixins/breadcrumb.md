# +Breadcrumb

用途はパンくずリストと `BreadcrumbList` 構造化データを出力すること。可視のマークアップとJSON-LDを同じ引数から組み立てる。派生レイアウトから呼ぶ。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` `Builder.url.base` `Builder.url.href` | pugkit が提供するグローバル |
| `metaData` | ベースレイアウトの `block vars` |
| `breadcrumb` | 派生レイアウト `_pageLayout.pug` の `block append vars` |

## 呼び出しの形

派生レイアウトが `block append vars` で `breadcrumb` を宣言し、`block contents` で呼ぶ。宣言と呼び出しの形は [../design/layout.md](../design/layout.md) にある。

ページ側は中間階層があるときだけ書き足す。

```pug
block append vars
  -
    metaData.pageTitle = '沿革'
    breadcrumb.middlePages = [{label: '会社案内', path: 'company/'}]
```

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `breadcrumb.middlePages` | object[] | `[]` | トップと現在地の間の中間ページ。順に並べる |
| `breadcrumb.middlePages[].label` | string | なし | 表示名 |
| `breadcrumb.middlePages[].path` | string | なし | ルートからのパス |
| `breadcrumb.pageTitle` | string | `metaData.pageTitle` | パンくずに出す現在ページ名 |

トップと現在地は mixin が足すので、渡すのは中間だけになる。`pageTitle` は title と違う文言をパンくずに出したいときだけ設定する。

## 組み立て

### 道筋を作る

先頭に `{label: 'ホーム', path: ''}` を置き、`middlePages` を順に続ける。現在地はこの道筋に入れず、最後に別で足す。

中間ページの `path` は正規化してから使う。

1. 先頭と末尾のスラッシュをすべて落とす
2. 空になったら空文字のまま返す
3. 末尾が `.html` のような拡張子なら、そのまま返す
4. それ以外は末尾に `/` を1つ足す

こうすると `company/` でも `/company/` でも `company` でも同じ結果になる。正規化しないと `/company/` が `..//company/` になり、`company` では canonical と一致しない URL が構造化データに入る。どちらもビルドは通ってしまう。

### 可視のマークアップ

`nav.c-breadcrumb` に `aria-label='パンくずリスト'` を付け、中に `ol.c-breadcrumb__list` を置く。道筋の各項目は `li.c-breadcrumb__item` の中の `a.c-breadcrumb__link` になり、`href` は `` `${Builder.dir}${path}` `` にする。最後に現在地の `li` を足し、`aria-current='page'` を付けてテキストで出す。

### 構造化データ

`nav` の直後に `script(type='application/ld+json')` を置き、`BreadcrumbList` を出す。

| 項目 | 値 |
|---|---|
| `@context` | `https://schema.org` |
| `@type` | `BreadcrumbList` |
| `itemListElement` | 道筋の各項目と現在地を `ListItem` にした配列 |

`ListItem` は `position` を1から振り、`name` に表示名を入れる。`item` は、道筋の項目なら `` `${Builder.url.base}/${path}` ``、現在地なら `Builder.url.href` にする。構造化データは絶対 URL を求めるので、`Builder.dir` の相対パスを使わない。

## 内側の幅

mixin にコンテナのクラスを書かない。幅は呼ぶ側が `.u-container` で包んで決める。mixin に書くと、幅の違うレイアウトから呼べなくなる。

## SCSS

この mixin 自体は見た目を持たない。`components/_breadcrumb.scss` を作って当てる。

区切り記号は `::before` などで描く。`&gt;` や `/` を文字として書くと読み上げに混ざる。

## やってはいけないこと

可視のマークアップとJSON-LDを別のmixinに分けない。構造化データは可視のパンくずと階層も表示名も一致している必要がある。分けると、中間階層を1つ足したときに片方だけ直すミスが起きる。

現在地をリンクにしない。`aria-current="page"` を付けたテキストで出す。

トップページからは呼ばない。ベースレイアウトを直接継承させれば、パンくずも構造化データも出ない。
