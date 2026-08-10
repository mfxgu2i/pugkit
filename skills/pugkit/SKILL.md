---
name: pugkit
description: pugkitの公式規約。pugkit.config.mjs があるプロジェクトで .pug / .scss / .ts・.js / 画像 / SVG ファイルを作成・編集するとき、およびゼロから新しい pugkit プロジェクトを立ち上げるときに使用する。pugkit と無関係な HTML/CSS/JS 作業には使用しないこと。
---

# pugkit

## 新規プロジェクトの開始

`npm create pugkit@latest` でスキャフォールドする。`pugkit.config.mjs` の値は推測で埋めず、ページ制作を始める前にユーザーに確認する（[references/project-setup.md](references/project-setup.md)）。

## ファイル命名規則

- `src/` では `_` で始まるディレクトリの中身が全種別でビルド対象外。ファイル名の `_` で除外できるのは `.pug` / `.scss` / `.ts` / `.js` だけで、画像と SVG はファイル名では除外されない。
- `public/` にこの規則は適用されず、置いたものがすべてコピーされる。
- それ以外は `src/` の構成を維持したまま `outDir`に出力される。
- Pug の `include` / `extends`、Sass の `@use` / `@forward`、JS の `import` は、`/` 始まりで `src/` を起点に解決される。(相対パスも可)
- `.pug` / `.scss` / `.ts` / `.js` は `_` の付かないファイルがすべてビルドの起点になる。他から読み込まれるだけの部品には `_` を付ける。
- `outDir` は pugkit が占有し、build のたびに中身を削除してから書き出す。出力に含めたいファイル（`.htaccess` など）は `public/` に置く。
- `@half` と `@<数字>w` で終わる画像名はビルドの予約名。`src/` にも `public/` にも置かない。
- `src/` と `public/` で出力先が同じになるファイルを作らない。

## Builder オブジェクト

サイト内リンク・アセットのパスは Builder オブジェクトから組み立てる。

```pug
//- サイト内リンク（相対パス）
a(href=`${Builder.dir}about/`) About

//- サイト内リンク（ルート相対パス）
a(href=`${Builder.subdir}/about/`) About

//- OGP / canonical には Builder.url を使う
meta(property='og:url' content=Builder.url.href)
link(rel='canonical' href=Builder.url.href)
```

| プロパティ             | 説明                               | 例                                        |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| `Builder.dir`          | 現在のページからルートへの相対パス | `./` or `../`                             |
| `Builder.subdir`       | サブディレクトリのパス             | `/subdirectory`                           |
| `Builder.url.origin`   | サイトのオリジン                   | `https://example.com`                     |
| `Builder.url.base`     | サイトのベースURL                  | `https://example.com/subdirectory`        |
| `Builder.url.pathname` | 現在のページのパス                 | `/about/`                                 |
| `Builder.url.href`     | 完全なURL                          | `https://example.com/subdirectory/about/` |

## imageInfo()

画像を参照する `img` は必ず `imageInfo()` を通す。パスは `${Builder.dir}` の相対パスで組み立てる。

`imageInfo()` にルート相対パス（`${Builder.subdir}/...`）を渡してはいけない。`/` 始まりは `src/` 直下からの参照として解決され `subdir` が考慮されないため、画像が見つからず `width` / `height` / `srcset` が付かない。ルート相対で書けるのは `a(href=...)` などのリンク側だけ。

`src/` には最大解像度の画像を1枚だけ置く。

- 戻り値・オプション・密度記述子と幅記述子の使い分けは [references/images.md](references/images.md)。
- アートディレクションは [references/art-direction.md](references/art-direction.md)。
- `public/` の画像は変換も縮小もされない（[references/public-images.md](references/public-images.md)）。

## Sass / TypeScript

Sass のエントリは `_` なし、パーシャルは `_` 付きで `@use` で読み込む。ベンダープレフィックスは自動付与されるため手書きしない。TypeScript は型チェックなしのトランスパイルのみで `tsconfig.json` は不要（[references/sass-typescript.md](references/sass-typescript.md)）。

## SVG アイコン

`src/` 配下の `icons/` に置いた SVG はスプライト化され、`use` で参照する。`fill` / `stroke` が `currentColor` に変換される単色前提のため、色は CSS の `color` で指定し、多色アイコンやロゴは `icons/` に置かない（[references/svg-icons.md](references/svg-icons.md)）。

## コマンド

Node.js 22 以上が必要。

| コマンド        | 用途                                            |
| --------------- | ----------------------------------------------- |
| `pugkit`        | ライブリロード付き開発サーバー（Ctrl+C で停止） |
| `pugkit build`  | `outDir` への本番ビルド                         |
| `pugkit check`  | ビルド済み出力の検査                            |
| `pugkit sprite` | SVG スプライト生成                              |

作業中は開発サーバーで確認し、最終確認は `pugkit build` の出力に対して行う。検査は `pugkit build && pugkit check` の順で実行する。詳細は [references/commands.md](references/commands.md)。

## Do / Don't

| Don't（禁止）                                                     | Do（正しい書き方）                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Builder を使わないパスの直書き（例: `a(href='/about/')`）         | Builder オブジェクトで組み立てる（例: ``a(href=`${Builder.dir}about/`)``） |
| サイト URL の直書き（例: `content='https://example.com/about/'`） | `content=Builder.url.href`                                      |
| `src/` 画像の生パス直書き（例: `img(src='/assets/img/hero.jpg')`） | ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)`` + `src=info.src srcset=info.srcset width=info.width height=info.height` |
| 同じ画像を解像度ごとに用意する                                    | 最大解像度を1枚置く。縮小版はビルドが生成する                   |
| `imageInfo()` にルート相対パスを渡す                              | ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)`` の相対パスで渡す |
| CSS の `url()` で `src/` の画像を元の拡張子のまま参照            | 変換後の拡張子で書くか、背景画像を `public/` に置く             |
| `src/` に `.webp` / `.avif` を置く（出力されず警告になる）        | 元形式（JPEG / PNG）を置いて `build.image.format` で変換する    |
| React/Vue などランタイムフレームワークの導入                      | Pug mixin + 素の TS/JS                                          |
| `outDir`（`dist/`）内のファイルを直接編集                         | `src/` 配下のソースを編集して再ビルド                           |
| `.htaccess` などを `outDir` に直接置く（build のたびに消える）    | `public/` に置く                                                |
| `_` なしでパーシャルを作成                                        | `src/_includes/_partial.pug`                                    |
| インライン SVG アイコン・`img` タグでのアイコン参照               | スプライト: ``use(href=`${Builder.dir}assets/icons.svg#name`)`` |

## リファレンス

以下のユースケースを実装する前に、対応するリファレンスを読むこと。各リファレンスは自己完結した実装パターンになっている。

| ユースケース                                 | リファレンス                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ |
| 新規 pugkit プロジェクトのセットアップ       | [references/project-setup.md](references/project-setup.md)   |
| 画像を出す（戻り値・密度記述子 / 幅記述子）  | [references/images.md](references/images.md)                 |
| アートディレクション（`picture` / `source`） | [references/art-direction.md](references/art-direction.md)   |
| `public/` 配下の画像・アセット               | [references/public-images.md](references/public-images.md)   |
| 設定オプションの変更                         | [references/config.md](references/config.md)                 |
| SVG アイコン（スプライト）                   | [references/svg-icons.md](references/svg-icons.md)           |
| Sass / TypeScript                            | [references/sass-typescript.md](references/sass-typescript.md) |
| コマンド・オプション・出力の検査             | [references/commands.md](references/commands.md)             |
| エラー・警告の読み方                         | [references/errors.md](references/errors.md)                 |

## レシピ

プロジェクトに同等のものがあればそれを使う。無い場合に参考にする実装例。

| レシピ           | ファイル                                             |
| ---------------- | ---------------------------------------------------- |
| 画像 mixin       | [recipes/image-mixin.md](recipes/image-mixin.md)     |
| アイコン mixin   | [recipes/icon-mixin.md](recipes/icon-mixin.md)       |
| head メタ mixin  | [recipes/meta-mixin.md](recipes/meta-mixin.md)       |
