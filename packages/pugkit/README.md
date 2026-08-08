# pugkit

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/pugkit">
    <img alt="" src="https://img.shields.io/npm/v/pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
  <a aria-label="License" href="https://github.com/mfxgu2i/pugkit/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
</p>

## How To Use

```sh
$ npm install --save-dev pugkit
$ touch ./src/index.pug
```

`package.json` にスクリプトを追加します。

```json
"scripts": {
  "start": "pugkit",
  "build": "pugkit build",
  "sprite": "pugkit sprite"
}
```

## Commands

| コマンド        | 内容                           |
| --------------- | ------------------------------ |
| `pugkit`        | 開発モード（Ctrl + C で停止）  |
| `pugkit build`  | 本番ビルド                     |
| `pugkit sprite` | SVGスプライト生成              |

## Directory Structure

```
project-root/
├── src/              # ソースファイル
│   ├── *.pug
│   ├── *.scss
│   ├── *.ts
│   ├── *.js
│   ├── *.jpg
│   ├── *.png
│   └── *.svg
├── public/           # 静的ファイル
│   ├── ogp.jpg
│   └── favicon.ico
├── dist/             # ビルド出力先
└── pugkit.config.mjs # ビルド設定ファイル
```

### File Naming Rules

`_`（アンダースコア）で始まるファイル・ディレクトリはビルド対象外です。それ以外のファイルは `src/` 配下のディレクトリ構成を維持したまま `outDir`（デフォルト: `dist/`）に出力されます。

```
src/foo/style.scss →  dist/foo/style.css
src/foo/bar/script.js  →  dist/foo/bar/script.js
```

## Configuration

プロジェクトルートに`pugkit.config.mjs`を配置することで、ビルド設定をカスタマイズできます。

```js
// pugkit.config.mjs
import { defineConfig } from 'pugkit'

export default defineConfig({
  siteUrl: 'https://example.com/',
  subdir: '',
  outDir: 'dist',
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    // 'avif' | 'webp' | 'compress' | false
    imageOptimization: 'webp',
    html: {
      indent_size: 2,
      wrap_line_length: 0
    }
  }
})
```

| Option                               | Description                                                                                           | Type / Values                                   | Default       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------- |
| `siteUrl`                            | サイトのベースURL（`Builder.url` に使用）                                                             | `string`                                        | `''`          |
| `subdir`                             | サブディレクトリのパス                                                                                | `string`                                        | `''`          |
| `outDir`                             | **build の**出力先ディレクトリ。相対・絶対パス・ネスト（`htdocs/v2`）・上位（`../htdocs`）も指定可。dev は書き込まない | `string`                                        | `'dist'`      |
| `cacheDir`                           | dev のアセット出力先。`null` で `node_modules/.pugkit/dev`（`node_modules` が無ければ `.pugkit/dev`）。**指定先は dev 起動のたびに中身が削除される** | `string` \| `null`                              | `null`        |
| `server.port`                        | 開発サーバーのポート番号                                                                              | `number`                                        | `5555`        |
| `server.host`                        | 開発サーバーのホスト                                                                                  | `string`                                        | `'localhost'` |
| `server.startPath`                   | 起動ログに表示する URL のパス                                                                         | `string`                                        | `'/'`         |
| `server.domDiff`                     | ライブリロードで DOM の差分適用を使うか（`false` で常にフルリロード）                                 | `boolean`                                       | `true`        |
| `build.imageOptimization`            | 画像最適化の方式                                                                                      | `'avif'` \| `'webp'` \| `'compress'`           | `'webp'`      |
| `build.imageSourceDensity`           | `src/` の画像を何倍の原本として扱うか。`2` なら等倍版を生成して `srcset` を出す                       | `1` \| `2`                                      | `2`           |
| `build.imageOptions.avif`            | AVIF変換オプション（[Sharp AVIF options](https://sharp.pixelplumbing.com/api-output#avif)）           | `object`                                        | -             |
| `build.imageOptions.webp`            | WebP変換オプション（[Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)）           | `object`                                        | -             |
| `build.imageOptions.jpeg`            | JPEG圧縮オプション（[Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)）           | `object`                                        | -             |
| `build.imageOptions.png`             | PNG圧縮オプション（[Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)）              | `object`                                        | -             |
| `build.imageInfo.artDirectionSuffix` | アートディレクション用画像のサフィックス（`_sp`, `_tb`, `_pc` など）                                  | `string`                                        | `'_sp'`       |
| `build.imageOverrides`               | 特定画像に個別のSharpオプションを適用（グローバルオプションに上書きマージ）                           | `Record<string, object>`                        | `{}`          |
| `build.html`                         | HTML整形オプション（[js-beautify html options](https://github.com/beautify-web/js-beautify#options)） | `object`                                        | see below     |

## Features

### Pug Templates

Pugテンプレート内では `Builder` オブジェクトと `imageInfo()` 関数が使用できます。

#### Builder Object

```pug
//- 相対パスでリンク
a(href=`${Builder.dir}about/`)

//- 完全なURL
meta(property='og:url', content=Builder.url.href)
```

| Property               | Description                        | Example                                   |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| `Builder.dir`          | 現在のページからルートへの相対パス | `./` or `../`                             |
| `Builder.subdir`       | サブディレクトリのパス             | `/subdirectory`                           |
| `Builder.url.origin`   | サイトのオリジン                   | `https://example.com`                     |
| `Builder.url.base`     | サイトのベースURL                  | `https://example.com/subdirectory`        |
| `Builder.url.pathname` | 現在のページのパス                 | `/about/`                                 |
| `Builder.url.href`     | 完全なURL                          | `https://example.com/subdirectory/about/` |

#### imageInfo()

`src/` 配下の画像のメタデータを取得します。`imageOptimization` に応じて `src` が最適化後のパスに変換され、`imageSourceDensity` に応じた `srcset` が組み立てられます。アートディレクション画像が存在する場合も自動的に解決されます。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
img(src=info.src srcset=info.srcset width=info.width height=info.height alt='')
```

| Property  | Type                                                                      | Description                                                        |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src`     | `string`                                                                  | 表示サイズ側のパス（`srcset` の `1x` と一致する）                  |
| `width`   | `number \| undefined`                                                     | 表示サイズの幅（px）                                               |
| `height`  | `number \| undefined`                                                     | 表示サイズの高さ（px）                                             |
| `srcset`  | `string \| undefined`                                                     | 密度記述子つきの `srcset`。画像が見つからない場合のみ `undefined`  |
| `format`  | `string \| undefined`                                                     | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）               |
| `isSvg`   | `boolean`                                                                 | SVG かどうか                                                       |
| `variant` | `{ src, width, height, srcset } \| null`                                  | `imageInfo.artDirectionSuffix` に応じたアートディレクション画像    |

```pug
- const info = imageInfo('/assets/img/hero.jpg')
picture
  //- アートディレクション
  if info.variant
    source(media='(max-width: 767px)' srcset=info.variant.srcset width=info.variant.width height=info.variant.height)
  img(src=info.src srcset=info.srcset width=info.width height=info.height alt='')
```

`imageSourceDensity: 2` で 1600×1200 の `hero.jpg` を置いた場合、出力は次のようになります。

```html
<img src="/assets/img/hero@half.webp"
     srcset="/assets/img/hero@half.webp 1x, /assets/img/hero.webp 2x"
     width="800" height="600">
```

> `imageInfo()` は `src/` 配下を探し、見つからなければ `public/` 配下も探します。
> `public/` の画像は変換も縮小もされないため、`src` は元のパスのまま返り、`srcset` は 1 枚だけになります。

### Sass

`src/` 配下の `.scss` ファイルをコンパイルして出力します。ベンダープレフィックスの自動付与と圧縮も行われます。

> ブラウザターゲットを指定する場合は、プロジェクトルートに `.browserslistrc` を配置してください。

### JavaScript / TypeScript

`src/` 配下の `.js` / `.ts` ファイルをバンドルして出力します。

esbuild がTypeScriptをネイティブ処理するため、`tsconfig.json` は不要です。ただし型チェックは行わずトランスパイルのみ行います。

#### TypeScript 型チェックを追加する（オプション）

型チェックが必要な場合は`typescript`を追加し、`tsc --noEmit`を組み合わせて使用します。

```sh
npm install --save-dev typescript
```

`tsconfig.json`をプロジェクトルートに作成します。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

`package.json` にスクリプトを追加します。

```json
"scripts": {
  "start": "pugkit",
  "build": "tsc --noEmit && pugkit build",
  "sprite": "pugkit sprite",
}
```

### Image Optimization

ビルド時に `src/` 配下の画像を自動的に最適化します。

- `'avif'` - PNG/JPEG/GIF を AVIF に変換
- `'compress'` - 元の形式を維持したまま圧縮
- `'webp'` - PNG/JPEG/GIF を WebP に変換

> **`src/` に置いた画像は必ず変換されます。** 変換したくない画像は `public/` に置いてください。

#### 画像は 1 枚だけ置く

`src/` には**最大解像度の 1 枚だけ**を置きます。等倍版はビルドが生成するので、`@2x` を手で用意する必要はありません。

```
src/assets/img/hero.jpg   (1600x1200)
  ↓  imageSourceDensity: 2
dist/assets/img/hero.webp      (1600x1200)   ← 無印は src と同じ寸法
dist/assets/img/hero@half.webp   ( 800x600)
```

無印を原寸のままにしているのは、CSS の `url()` 直書きや OGP 画像など `imageInfo()` を通らない参照が壊れないようにするためです。

| 設定                    | 挙動                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `imageSourceDensity: 2` | 等倍版を生成し、`srcset` に `1x` / `2x` を並べる（既定）   |
| `imageSourceDensity: 1` | 原寸を 1 枚出すだけ。縮小も `srcset` も行わない            |

等倍のまま出したい画像（ロゴやアイコンなど）は `public/` に置いてください。`public/` の画像は変換も縮小もされません。

> GIF と SVG は密度の対象外です（GIF は縮小するとアニメーションが失われるため）。

#### 特定画像の個別オプション指定

`build.imageOverrides` で特定の画像にのみ別の圧縮オプションを適用できます。キーは `src/` からの相対パス、値はグローバル設定に上書きマージされる [Sharp](https://sharp.pixelplumbing.com/api-output) オプションオブジェクトです。

```js
build: {
  imageOptimization: 'webp',
  imageOverrides: {
    // 品質を上げたい画像
    'assets/img/bg-hero.jpg': { quality: 100 },
  }
}
```

### HTML Formatting

ビルド時にPugから生成されたHTMLを[js-beautify](https://github.com/beautify-web/js-beautify)で整形します。`build.html` で js-beautify の設定をそのまま渡せます。

```js
build: {
  html: {
    indent_size: 2,
    indent_with_tabs: false,
    wrap_line_length: 0,
    inline: [],
    content_unformatted: ['script', 'style', 'pre']
  }
}
```

利用可能なオプションは [js-beautify のドキュメント](https://github.com/beautify-web/js-beautify#options)を参照してください。

### SVG Optimization

`icons/`以外に配置した SVG ファイルはSVGOで自動最適化されて出力されます。

### SVG Sprite

`src/`配下の`icons/`ディレクトリに配置したSVGを1つのスプライトファイルにまとめます。

```
`src/assets/icons/arrow.svg  →  <outDir>/assets/icons.svg#arrow`
```

```html
<svg><use href="assets/icons.svg#arrow"></use></svg>
```

- SVG ファイル名がそのまま `<symbol id>` になります
- `fill` / `stroke` は自動的に `currentColor` に変換されます

### Public Directory

`public/` に置いたファイルはそのまま `outDir` のルートにコピーされます。**変換も縮小もされない**ので、favicon・OGP画像のほか、等倍のまま出したい画像の置き場としても使います。

`src/` と `public/` で同じ出力先になる画像があった場合は、どちらが残るかが決まらないため**ビルドを中止します**。どちらか一方を削除してください。

### Dev / Build の出力の違い

| 対象 | dev                                       | build                        |
| ---- | ----------------------------------------- | ---------------------------- |
| HTML | リクエスト時ビルド + メモリ配信（ファイルに書き出さない） | 全ページビルドして書き出し   |
| CSS  | expanded + ソースマップ                   | minify済み                   |
| JS   | ソースマップ・`console.*` 保持            | minify済み・`console.*` 削除 |
| 出力先 | `cacheDir`（既定 `node_modules/.pugkit/dev`） | `outDir`                     |

> **`outDir` は build 専用です。** dev は `outDir` に書き込みも読み出しもしないため、dev のソースマップ等が本番成果物に混ざりません。
>
> **`outDir` は pugkit が占有します。** build のたびに中身を削除してから書き出すので、手で置いたファイル（`.htaccess`・PHP・アップロード等）は残りません。出力に含めたいものは `public/` に置いてください。
>
> dev が配信するのは `src` と `public` から導かれるものだけです。レガシー HTML など `outDir` にしか無いファイルを dev でも表示したい場合は `public/` に置いてください（build でも `outDir` にコピーされるので、dev と build で同じものが見えます）。
>
> **`cacheDir` に指定したディレクトリは dev 起動のたびに中身が削除されます。** 既存ファイルのある場所を指定しないでください（プロジェクトルート・`src`・`public`・`outDir` は起動時にエラーになります）。

> 旧 `debug` オプションは廃止されました。dev は常にソースマップ付き非圧縮出力になります。

### エラー表示

CLI が異常終了したときは、原因のメッセージだけを表示して終了コード `1` を返します。設定ミスや出力先の衝突など、ソースを直せば済むエラーがスタックトレースに埋もれないようにするためです。

pugkit 自身の不具合を調べたい場合は `PUGKIT_DEBUG=1` を付けるとスタックトレースが出ます。

```sh
PUGKIT_DEBUG=1 npx pugkit build
```

## Tech Stack

- [Pug](https://pugjs.org/) - HTMLテンプレートエンジン
- [Sass](https://sass-lang.com/) - CSSプリプロセッサー
- [esbuild](https://esbuild.github.io/) - TypeScript/JavaScriptバンドラー
- [PostCSS](https://postcss.org/) - CSS後処理（Autoprefixer、cssnano）
- [Sharp](https://sharp.pixelplumbing.com/) - 画像最適化
- [SVGO](https://svgo.dev/) - SVG最適化
- [Chokidar](https://github.com/paulmillr/chokidar) - ファイル監視
- [sirv](https://github.com/lukeed/sirv) + SSE（Server-Sent Events） - 開発サーバー
