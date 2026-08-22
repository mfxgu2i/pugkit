---
name: pugkit
description: pugkit のビルド仕様とAPI。Builder・imageInfo・SVGスプライト・設定・コマンド・エラーの読み方を持つ。pugkit.config.mjs があるプロジェクトで .pug / .scss / .ts・.js / 画像 / SVG を作成・編集するとき、ビルドや pugkit check の失敗を読むとき、pugkit.config.mjs を変更するとき、ゼロから新しい pugkit プロジェクトを立ち上げるときに使用する。CSS設計・コンポーネント設計・mixin の実装例は扱わない。pugkit と無関係な HTML/CSS/JS 作業には使用しないこと。
---

# pugkit

## 新規プロジェクトの開始

`npm create pugkit@latest` でスキャフォールドする。`pugkit.config.mjs` の値は推測で埋めず、ページ制作を始める前にユーザーに確認する（[references/project-setup.md](references/project-setup.md)）。

## ファイル命名規則

- `src/` では `_` で始まるディレクトリの中身が全種別でビルド対象外。ファイル名の `_` で除外できるのは `.pug` / `.scss` / `.ts` / `.js` だけで、画像と SVG はファイル名では除外されない。
- `.pug` / `.scss` / `.ts` / `.js` は `_` の付かないファイルがすべてビルドの起点になる。他から読み込まれるだけの部品には `_` を付ける。
- Pug の `include` / `extends`、Sass の `@use` / `@forward`、JS の `import` は、`/` 始まりで `src/` を起点に解決される。(相対パスも可)
- `@half` と `@<数字>w` で終わる画像名、`icons.svg` はビルドの予約名。`src/` にも `public/` にも置かない。

## 出力規則

- `src/` の構成を維持したまま `outDir` に出力される。
- `public/` に命名規則は適用されず、置いたものがすべてコピーされる。
- `outDir` は pugkit が占有し、build のたびに中身を削除してから書き出す。出力に含めたいファイル（`.htaccess` など）は `public/` に置く。
- `src/` と `public/` で出力先が同じになるファイルを作らない。

## Builder オブジェクト

サイト内リンク・アセットのパスは Builder オブジェクトから組み立てる。

```pug
//- サイト内リンク（相対パス）
a(href=`${Builder.dir}about/`) About

//- サイト内リンク（ルート相対パス）
a(href=`${Builder.subdir}/about/`) About

//- 現在のページのルート相対パス。トップかどうかは subdir 込みの形と比べる
- const isTop = Builder.url.pathname === `${Builder.subdir}/`
a(href=Builder.url.pathname) このページ

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
| `Builder.url.pathname` | 現在のページのパス（`subdir` を含む） | `/subdirectory/about/`                |
| `Builder.url.href`     | 完全なURL                          | `https://example.com/subdirectory/about/` |

## imageInfo()

画像を参照する `img` は必ず `imageInfo()` を通す。パスは `${Builder.dir}` の相対パスか、`${Builder.subdir}` を前置きしたルート相対パスで組み立てる。

ルート相対で書くときは `${Builder.subdir}` を必ず前置きする。`/` 始まりはサイトルート起点の URL として解決するため、前置きが無いと `subdir` を設定したときに画像が見つからない。リンク側の ``a(href=`${Builder.subdir}/about/`)`` と同じ規則。

`src/` には最大解像度の画像を1枚だけ置く。

- 戻り値・オプション・密度記述子と幅記述子の使い分けは [references/images.md](references/images.md)。
- アートディレクションは [references/art-direction.md](references/art-direction.md)。
- `public/` の画像は変換も縮小もされない（[references/public-images.md](references/public-images.md)）。

## Sass / TypeScript

Sass のエントリは `_` なし、パーシャルは `_` 付きで `@use` で読み込む。ベンダープレフィックスは自動付与されるため手書きしない。TypeScript は型チェックなしのトランスパイルのみで `tsconfig.json` は不要（[references/sass-typescript.md](references/sass-typescript.md)）。

## SVG アイコン

`src/` 配下の `icons/` に置いた SVG はスプライト化され、`use` で参照する。`fill` / `stroke` が `currentColor` に変換される単色前提のため、色は CSS の `color` で指定し、多色アイコンやロゴは `icons/` に置かない（[references/svg-icons.md](references/svg-icons.md)）。

## コマンド

Node.js 22.22.2 以上が必要。

開発サーバーが `pugkit`、本番ビルドが `pugkit build`、出力の検査が `pugkit check`、スプライト生成が `pugkit sprite`。

作業中は開発サーバーで確認し、最終確認は `pugkit build` の出力に対して行う。検査は `pugkit build && pugkit check` の順で実行する。エイリアスとオプションを含む一覧は [references/commands.md](references/commands.md)。

## Do / Don't

| Don't（禁止）                                                      | Do（正しい書き方）                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Builder を使わないパスの直書き（例: `a(href='/about/')`）          | Builder オブジェクトで組み立てる（例: ``a(href=`${Builder.dir}about/`)``）                                                 |
| サイト URL の直書き（例: `content='https://example.com/about/'`）  | `content=Builder.url.href`                                                                                                 |
| `src/` 画像の生パス直書き（例: `img(src='/assets/img/hero.jpg')`） | ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)`` + `src=info.src srcset=info.srcset width=info.width height=info.height` |
| 同じ画像を解像度ごとに用意する                                     | 最大解像度を1枚置く。縮小版はビルドが生成する                                                                              |
| `imageInfo()` に `${Builder.subdir}` 抜きのルート相対パスを渡す    | ``imageInfo(`${Builder.subdir}/assets/img/hero.jpg`)`` か ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)``               |
| CSS の `url()` で `src/` の画像を元の拡張子のまま参照              | 変換後の拡張子で書くか、背景画像を `public/` に置く                                                                        |
| `src/` に `.webp` / `.avif` を置く（出力されず警告になる）         | 元形式（JPEG / PNG）を置いて `build.image.format` で変換する                                                               |
| React/Vue などランタイムフレームワークの導入                       | Pug mixin + 素の TS/JS                                                                                                     |
| `outDir`（`dist/`）内のファイルを直接編集                          | `src/` 配下のソースを編集して再ビルド                                                                                      |
| `.htaccess` などを `outDir` に直接置く（build のたびに消える）     | `public/` に置く                                                                                                           |
| `_` なしでパーシャルを作成                                         | `src/_includes/_partial.pug`                                                                                               |
| インライン SVG アイコン・`img` タグでのアイコン参照                | スプライト: ``use(href=`${Builder.dir}assets/icons.svg#name`)``                                                            |

## リファレンス

以下のユースケースを実装する前に、対応するリファレンスを読むこと。各リファレンスは自己完結した実装パターンになっている。

| ユースケース                                 | リファレンス                                                   |
| -------------------------------------------- | -------------------------------------------------------------- |
| 新規 pugkit プロジェクトのセットアップ       | [references/project-setup.md](references/project-setup.md)     |
| 画像を出す（戻り値・密度記述子 / 幅記述子）  | [references/images.md](references/images.md)                   |
| アートディレクション（`picture` / `source`） | [references/art-direction.md](references/art-direction.md)     |
| `public/` 配下の画像・アセット               | [references/public-images.md](references/public-images.md)     |
| 設定オプションの変更                         | [references/config.md](references/config.md)                   |
| SVG アイコン（スプライト）                   | [references/svg-icons.md](references/svg-icons.md)             |
| Sass / TypeScript                            | [references/sass-typescript.md](references/sass-typescript.md) |
| コマンド・オプション・出力の検査             | [references/commands.md](references/commands.md)               |
| エラー・警告の読み方                         | [references/errors.md](references/errors.md)                   |
