# +Meta

用途は `title` と `description`、canonical、OGP、favicon を1か所で出力すること。ベースレイアウトの head 先頭で1回だけ呼ぶ。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` `Builder.url` `Builder.subdir` | pugkit が提供するグローバル |
| `META_DATA` | `_templates/_constants.pug` |

## 呼び出しの形

レイアウトの `block vars` で `META_DATA` を `metaData` に受け、head で呼ぶ。ページは `block append vars` で値を上書きする。

```pug
//- レイアウト
block vars
  - const metaData = META_DATA

html(lang=metaData.lang)
  head
    +Meta(metaData)
```

```pug
//- ページ
block append vars
  -
    metaData.pageTitle = '会社概要'
    metaData.pageDescription = '会社概要ページの説明。'
```

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `meta.locale` | string | なし | `og:locale` の値。空なら出さない |
| `meta.siteTitle` | string | なし | サイト名。タイトルの後半に入る |
| `meta.siteDescription` | string | なし | `pageDescription` が空のときの代替 |
| `meta.pageTitle` | string | `''` | ページ名。空だとサイト名だけになる |
| `meta.pageDescription` | string | `''` | ページの説明 |
| `meta.pageType` | string | `'website'` | `og:type` の値。記事ページは `'article'` |

## 出力するもの

上から順に出す。

| まとまり | 要素 |
|---|---|
| 基本 | `charset` は `UTF-8`。`viewport` は `width=device-width,initial-scale=1` |
| アイコン | `link[rel=icon]` に `` `${Builder.dir}favicon.ico` `` |
| タイトルと説明 | `title` と `meta[name=description]` |
| 正規化 | `link[rel=canonical]` に `Builder.url.href`。全ページに出す |
| OGP | `og:title` `og:url` `og:description` `og:type` `og:image` `og:site_name` `og:locale` と `twitter:card` |

OGP 画像は `public/assets/img/common/ogp.jpg` に置く。`public/` なので変換されず、置いたまま出力される。

`og:url` は `Builder.url.href`、`og:image` は `` `${Builder.url.base}/assets/img/common/ogp.jpg` ``、`og:locale` は `meta.locale`、`twitter:card` は `summary_large_image` にする。`og:title` と `og:site_name` はタイトルとサイト名をそのまま使う。

## タイトルと説明の組み立て

トップページはサイト名だけ、下層は `ページ名｜サイト名` になる。区切りは全角の縦棒。

トップかどうかは `Builder.url.pathname` が `` `${Builder.subdir}/` `` と一致するかで見る。`pathname` は `subdir` を含むので、この形で比べる。`subdir` が空なら `/` になるため、`subdir` があってもなくても、この形のまま効く。

`pageTitle` が空のときもサイト名だけになる。下層ページで設定を忘れるとトップと同じタイトルが出る。

`META_DATA` の `pageTitle` の初期値は空文字にする。仮の文字列を入れておくと、設定を忘れたページにその文字列がそのまま出る。

説明は `pageDescription` を使い、空なら代わりに `siteDescription` を使う。

タイトルは `title= title` と `content=title` のようにエスケープして出す。`!{}` や `content!=` で出すと、ページ名の `&` や `<` がそのまま HTML に入る。

## やってはいけないこと

ページごとに `title` や `meta[name=description]` を直接書かない。この mixin を通さないとタイトルの組み立て規則が効かず、トップと下層で書式がばらつく。

OGP画像のパスをページごとに変えたくなったら、引数に足して mixin 側で分岐させる。ページ側で `meta[property=og:image]` を二重に出力しない。

トップページの判定に `Builder.pathname` を使わない。存在しないプロパティで、常に `undefined` になる。

`Builder.url` のどのプロパティをどこに使うかは pugkit skill の `pugkit/SKILL.md` にある。

`siteUrl` が空のまま `Builder.url.href` / `base` を参照すると相対パスが入り、警告が出る。
