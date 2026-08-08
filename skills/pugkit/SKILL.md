---
name: pugkit
description: pugkit（クリーンな納品用HTMLを出力する Pug / Sass / TypeScript の静的サイトビルドツール）の公式規約。pugkit.config.mjs があるプロジェクトで .pug / .scss / .ts・.js / 画像 / SVG ファイルを作成・編集するとき、およびゼロから新しい pugkit プロジェクトを立ち上げるときに使用する。pugkit と無関係な Pug/Sass/HTML 作業、および pugkit ツール自体の開発時には使用しないこと。
---

# pugkit

## 新規プロジェクトの開始

新規プロジェクトは `npm create pugkit@latest` でスキャフォールドする。`pugkit.config.mjs` の値（`siteUrl` / `subdir` / `outDir` / `build.imageOptimization`）は推測で埋めず、ページ制作を始める前にユーザーに確認する（[references/project-setup.md](references/project-setup.md) を参照）。

## ファイル命名規則

- `_` で始まるファイル・ディレクトリはビルド対象外。パーシャルや共通ファイルには必ず `_` を付ける。
- それ以外は `src/` の構成を維持したまま `outDir`（デフォルト: `dist/`）に出力される: `src/foo/style.scss` → `dist/foo/style.css`
- `outDir` は pugkit が占有し、build のたびに中身を削除してから書き出す。`outDir` 内のファイルは直接編集せず、出力に含めたいファイル（`.htaccess` など）は `public/` に置く。
- Pug の `extends` / `include` で `/` 始まりのパスは `src/` を起点に解決される（例: `extends /_templates/_layout`）。
- 新規ページはプロジェクトの共通レイアウトを `extends` して作る。既存の兄弟ページを開いて `extends` 先と block 構造を確認し、それに倣う（[references/new-page.md](references/new-page.md) を参照）。

## Builder オブジェクト

サイト内リンク・アセットのパスは Builder オブジェクトから組み立てる。パスを直書きすると、後から `subdir` や `siteUrl` を設定したときに更新漏れが起きる。

```pug
//- サイト内リンク（相対パス: Builder.dir）
a(href=`${Builder.dir}about/`) About

//- サイト内リンク（ルート相対パス: Builder.subdir）
a(href=`${Builder.subdir}/about/`) About

//- アセット参照（どちらの形式でもよい）
link(rel='stylesheet' href=`${Builder.dir}assets/css/style.css`)

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

`siteUrl` と `subdir` は `pugkit.config.mjs` から取得される。OGP 画像など外部から取得される URL は `Builder.url.base` から絶対 URL で組む（[references/ogp-meta.md](references/ogp-meta.md) を参照）。

## imageInfo()（すべての画像参照で必須）

画像を参照する `img` は必ず `imageInfo()` を通し、パスは `Builder.dir` を先頭に付けて渡す（返される `src` は渡したパスの形式を保つ）。画像ファイルは `src/` から探し、無ければ `public/` も探す:

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`)
img(src=info.src width=info.width height=info.height alt='ヒーロー画像')
```

- `info.src` は `build.imageOptimization` の設定に応じて最適化後のパス（`.webp` / `.avif`）へ自動解決される。手書きの `hero.jpg` パスは、ビルド出力には存在しないファイルを指してしまう。
- `imageInfo()` の `width` / `height` によりレイアウトシフト（CLS）を防げる。
- プロジェクトに共通の画像 mixin（`imageInfo()` ベースの img/picture コンポーネント）がある場合は、生の `imageInfo()` を繰り返さずそれを使う。

戻り値のプロパティ: `src`、`width`、`height`、`format`、`isSvg`、`retina`（`@2x` 画像を自動検出、なければ `null`）、`variant`（`build.imageInfo.artDirectionSuffix`〔デフォルト `_sp`〕で検出したアートディレクション画像、なければ `null`）。

- retina: `info.retina` があれば 1x/2x の `srcset` を出す（[references/retina-srcset.md](references/retina-srcset.md)）。アートディレクション: `info.variant` があれば `picture` + `source` を使う（[references/art-direction.md](references/art-direction.md)）。
- `public/` のファイルはビルドで変換されずそのままコピーされる。`public/` に置く画像は最終形式（`.webp` など）にしておく（[references/public-images.md](references/public-images.md)）。

## SVG アイコン

`src/` 配下の `icons/` ディレクトリに置いた SVG は、ディレクトリ単位で1つのスプライトにまとめられる（`src/assets/icons/arrow.svg` → `<outDir>/assets/icons.svg#arrow`）。`use` で参照する:

```pug
svg(width='24' height='24' aria-hidden='true')
  use(href=`${Builder.dir}assets/icons.svg#arrow`)
```

- `fill` / `stroke` は `currentColor` に変換されるため、アイコンの色は CSS の `color` で指定する。単色前提なので、多色アイコンやロゴは `icons/` に置かず通常の SVG として参照する。
- インライン `<svg>` 直書きや `img` タグでのアイコン参照よりスプライトを優先する。
- スプライトは `pugkit build` と開発サーバーの両方で自動生成され、`icons/` の変更時も自動で再生成される。

## Sass / TypeScript

- エントリファイルは `_` なし。パーシャルは `_` 付きで `@use` で読み込む。
- Autoprefixer と minify は自動。ブラウザターゲットはプロジェクトルートの `.browserslistrc` で指定する。ベンダープレフィックスは手書きしない。
- TypeScript は esbuild によるトランスパイルのみ（型チェックなし）。`tsconfig.json` は不要。型チェックが明示的に求められる場合のみ `tsc --noEmit` と合わせて追加する。

## コマンドと開発フロー

| コマンド        | 用途                                             |
| --------------- | ------------------------------------------------ |
| `pugkit`        | ライブリロード付き開発サーバー（Ctrl+C で停止）  |
| `pugkit build`  | `outDir` への本番ビルド                          |
| `pugkit sprite` | SVG スプライト生成                               |

`pugkit dev` は `pugkit` のエイリアス。プロジェクトに npm scripts があればそちらを使う。

開発サーバーはリクエスト時ビルドとメモリ配信で動き、`outDir` には書き込みも読み出しもしない（dev のアセットは `cacheDir`〔既定: `node_modules/.pugkit/dev`〕に出力される）。作業中は開発サーバーで確認し、最終確認は実際の `pugkit build` の出力に対して行う。

## Do / Don't

| Don't（禁止）                                                     | Do（正しい書き方）                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Builder を使わないパスの直書き（例: `a(href='/about/')`）         | Builder オブジェクトで組み立てる（例: ``a(href=`${Builder.dir}about/`)``） |
| サイト URL の直書き（例: `content='https://example.com/about/'`） | `content=Builder.url.href`                                      |
| `src/` 画像の生パス直書き（例: `img(src='/assets/img/hero.jpg')`） | ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)`` + `src=info.src width=info.width height=info.height` |
| React/Vue などランタイムフレームワークの導入                      | Pug mixin + 素の TS/JS                                          |
| `outDir`（`dist/`）内のファイルを直接編集                         | `src/` 配下のソースを編集して再ビルド                           |
| `.htaccess` などを `outDir` に直接置く（build のたびに消える）    | `public/` に置く（`outDir` のルートへそのままコピーされる）     |
| `_` なしでパーシャルを作成                                        | `src/_includes/_partial.pug`                                    |
| インライン SVG アイコン・`img` タグでのアイコン参照               | スプライト: ``use(href=`${Builder.dir}assets/icons.svg#name`)`` |

## リファレンス

以下のユースケースを実装する前に、対応するリファレンスを読むこと。各リファレンスは自己完結した実装パターンになっている。

| ユースケース                                 | リファレンス                                                |
| -------------------------------------------- | ----------------------------------------------------------- |
| 新規 pugkit プロジェクトのセットアップ       | [references/project-setup.md](references/project-setup.md) |
| 新規ページの追加（手順・レイアウト選択）     | [references/new-page.md](references/new-page.md)           |
| 共通レイアウト（block 構成・派生・作成）     | [references/layout.md](references/layout.md)               |
| Retina 画像（1x/2x srcset）                  | [references/retina-srcset.md](references/retina-srcset.md) |
| アートディレクション（`picture` / `source`） | [references/art-direction.md](references/art-direction.md) |
| `public/` 配下の画像・アセット               | [references/public-images.md](references/public-images.md) |
| OGP / canonical の URL 組み立て              | [references/ogp-meta.md](references/ogp-meta.md)           |
