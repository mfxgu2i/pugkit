# OGP / canonical の URL 組み立て

head メタの出力は共通の meta mixin（テンプレートでは `+Meta(metaData)`）に一本化し、ページ側で meta タグを直接書かない。OGP / canonical で使う URL は以下の原則で組み立てる:

| 出力先                       | 使うもの                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `og:url` / `canonical`       | `Builder.url.href`（現在ページの完全 URL）                                       |
| `og:image`                   | `Builder.url.base` + サイトルートからのパス（絶対 URL 必須）                     |
| favicon などサイト内リソース | Builder で組み立てたパス（`${Builder.dir}` / `${Builder.subdir}/` どちらでも可） |

```pug
meta(property='og:url' content=Builder.url.href)
link(rel='canonical' href=Builder.url.href)

//- OGP 画像（public/ 直下に置いた場合）
meta(property='og:image' content=`${Builder.url.base}/ogp.jpg`)

link(rel='icon' href=`${Builder.dir}favicon.ico`)
```

- OGP 画像は SNS クローラーが外部から取得するため**絶対 URL が必須**であり、相対パス・ルート相対パスは使えない。
- `siteUrl` が未設定だと絶対 URL が組めないため、事前に `pugkit.config.mjs` の `siteUrl` を確認する。
