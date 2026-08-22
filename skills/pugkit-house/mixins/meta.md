# +Meta

用途は `title` と `description`、canonical、OGP、favicon を1か所で出力すること。ベースレイアウトの head 先頭で1回だけ呼ぶ。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` `Builder.url` | pugkit が提供するグローバル |
| `META_DATA` | `_templates/_constants.pug` |

## mixin

```pug
mixin Meta(meta = {})
  -
    const site = {
      title: meta.siteTitle || '__サイトタイトル__',
      description: meta.siteDescription || '__サイト説明文__',
    }

    const page = {
      title: meta.pageTitle || '',
      description: meta.pageDescription || '',
      type: meta.pageType || 'article'
    }

    const title = Builder.url.pathname === `${Builder.subdir}/` || !page.title ? site.title : `${page.title}｜${site.title}`
    const description = page.description || site.description
    const ogImage = `${Builder.url.base}/assets/img/common/ogp.jpg`

  //- 基本メタ情報
  meta(charset='UTF-8')
  meta(name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover')
  meta(name='format-detection' content='telephone=no')
  meta(name='mobile-web-app-capable' content='yes')

  //- アイコン
  link(rel='icon' href=`${Builder.dir}favicon.ico`)

  //- タイトルと説明
  title !{title}
  meta(name='description' content=description)

  //- 正規化。全ページに出す
  link(rel='canonical' href=Builder.url.href)

  //- OGP
  meta(property='og:title' content!=title)
  meta(property='og:url' content=Builder.url.href)
  meta(property='og:description' content=description)
  meta(property='og:type' content=page.type)
  meta(property='og:image' content=ogImage)
  meta(property='og:site_name' content=site.title)
  meta(property='og:locale' content='ja_JP')
  meta(name='twitter:card' content='summary_large_image')
```

## 定数

サイト共通の値は定数ファイルに置く。

```pug
-
  const META_DATA = {
    siteTitle: 'サイト名',
    siteDescription: 'サイトの説明',
    pageTitle: '',
    pageDescription: '',
    pageType: 'article'
  }
```

## 引数

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `meta.siteTitle` | string | なし | サイト名。タイトルの後半に入る |
| `meta.siteDescription` | string | なし | `pageDescription` が空のときの代替 |
| `meta.pageTitle` | string | `''` | ページ名。空だとサイト名だけになる |
| `meta.pageDescription` | string | `''` | ページの説明 |
| `meta.pageType` | string | `'article'` | `og:type` の値。トップは `'website'` |

## 使用例

レイアウトの head で呼び出し、ページ側は変数を上書きする。

```pug
//- レイアウト
block vars
  - const metaData = META_DATA

html(lang='ja')
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

## タイトルの組み立て

トップページはサイト名だけ、下層は `ページ名｜サイト名` になる。区切りは全角の縦棒。カテゴリ名を挟む場合は `ページ名｜カテゴリ名｜サイト名` にする。

`pageTitle` が空のときもサイト名だけになるので、下層ページで設定を忘れるとトップと同じタイトルが出る。

## やってはいけないこと

ページごとに `title` や `meta[name=description]` を直接書かない。この mixin を通さないとタイトルの組み立て規則が効かず、トップと下層で書式がばらつく。

OGP画像のパスをページごとに変えたくなったら、引数に足して mixin 側で分岐させる。ページ側で `meta[property=og:image]` を二重に出力しない。

トップページの判定に `Builder.pathname` を使わない。存在しないプロパティで、常に `undefined` になる。`Builder.url.pathname` が正しい。`pathname` は `subdir` を含むので、`` `${Builder.subdir}/` `` と突き合わせる。`subdir` が空なら `/` になるため、この形のまま両方に効く。

`Builder.url` のどのプロパティをどこに使うかは pugkit skill の `pugkit/SKILL.md` にある。

`siteUrl` が空のまま `Builder.url.href` / `base` を参照すると相対パスが入り、警告が出る。
