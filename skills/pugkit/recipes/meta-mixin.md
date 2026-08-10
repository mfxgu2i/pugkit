# head メタ mixin

`title` / `description` / OGP / favicon を1箇所で出力する mixin。ページごとに meta タグを直接書かず、変数を渡すだけにする。

**プロジェクトに既存の meta mixin があればそれを使う。** これは無い場合に作るための実装例で、create-pugkit テンプレートの `src/_templates/mixins/_Meta.pug` と同じもの。

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

    const title = Builder.url.pathname === '/' || !page.title ? site.title : `${page.title}｜${site.title}`
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

  //- OGP
  meta(property='og:title' content!=title)
  meta(property='og:url' content=Builder.url.href)
  meta(property='og:description' content=description)
  meta(property='og:type' content=page.type)
  meta(property='og:image' content=ogImage)
  meta(property='og:site_name' content=site.title)
  meta(name='twitter:card' content='summary_large_image')
```

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

## 使い方

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

## URL の組み立て

| 出力       | 使うもの                            | 理由                                             |
| ---------- | ----------------------------------- | ------------------------------------------------ |
| `og:url`   | `Builder.url.href`                  | 外部から取得されるので絶対 URL が必要            |
| `og:image` | `Builder.url.base` + ルートからのパス | 同上。`public/` に置いた画像を指す               |
| favicon    | `${Builder.dir}` の相対パス         | `subdir` 配信でも壊れない                        |

トップページの判定は `Builder.url.pathname` を使う。`Builder.pathname` というプロパティは存在しない。

`siteUrl` が空のまま `Builder.url.href` / `base` を参照すると相対パスが入り、警告が出る。
