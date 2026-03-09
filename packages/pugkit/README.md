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
| `pugkit bench`  | 画像サイズベンチマーク（全体） |

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
  debug: false,
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
| `outDir`                             | ビルド出力先ディレクトリ。相対・絶対パス・ネスト（`htdocs/v2`）・上位（`../htdocs`）も指定可          | `string`                                        | `'dist'`      |
| `debug`                              | デバッグモード（開発時のみ有効）                                                                      | `boolean`                                       | `false`       |
| `server.port`                        | 開発サーバーのポート番号                                                                              | `number`                                        | `5555`        |
| `server.host`                        | 開発サーバーのホスト                                                                                  | `string`                                        | `'localhost'` |
| `server.startPath`                   | サーバー起動時に開くパス                                                                              | `string`                                        | `'/'`         |
| `build.clean`                        | ビルド前に `outDir` をクリーンするか（`false` にすると他リソースと共存可能）                          | `boolean`                                       | `true`        |
| `build.imageOptimization`            | 画像最適化の方式                                                                                      | `'avif'` \| `'webp'` \| `'compress'` \| `false` | `'webp'`      |
| `build.imageOptions.avif`            | AVIF変換オプション（[Sharp AVIF options](https://sharp.pixelplumbing.com/api-output#avif)）           | `object`                                        | -             |
| `build.imageOptions.webp`            | WebP変換オプション（[Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)）           | `object`                                        | -             |
| `build.imageOptions.jpeg`            | JPEG圧縮オプション（[Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)）           | `object`                                        | -             |
| `build.imageOptions.png`             | PNG圧縮オプション（[Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)）              | `object`                                        | -             |
| `build.imageInfo.artDirectionSuffix` | アートディレクション用画像のサフィックス（`_sp`, `_tb`, `_pc` など）                                  | `string`                                        | `'_sp'`       |
| `build.imageOverrides`               | 特定画像に個別のSharpオプションを適用（グローバルオプションに上書きマージ）                           | `Record<string, object>`                        | `{}`          |
| `build.html`                         | HTML整形オプション（[js-beautify html options](https://github.com/beautify-web/js-beautify#options)） | `object`                                        | see below     |
| `benchmark.image.threshold`          | `pugkit bench` で警告を出すファイルサイズ上限                                                         | `string` (`'200KB'` / `'1MB'` など)             | `'300KB'`     |
| `benchmark.image.qualityMin`         | シミュレーションの quality 最小値                                                                     | `number`                                        | `40`          |
| `benchmark.image.qualityMax`         | シミュレーションの quality 最大値                                                                     | `number`                                        | `90`          |
| `benchmark.image.qualityStep`        | シミュレーションの quality ステップ幅                                                                 | `number`                                        | `10`          |

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

`src/` 配下の画像のメタデータを取得します。`imageOptimization` の設定に応じて `src` が最適化後のパスに変換され、retina / アートディレクション画像が存在する場合も自動的に解決されます。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
img(src=info.src width=info.width height=info.height alt='')
```

| Property  | Type                                                     | Description                                                                   |
| --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src`     | `string`                                                 | 最適化設定に応じたパス（avifモード時は `.avif`、webpモード時は `.webp` パス） |
| `width`   | `number \| undefined`                                    | 画像の幅（px）                                                                |
| `height`  | `number \| undefined`                                    | 画像の高さ（px）                                                              |
| `format`  | `string \| undefined`                                    | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）                          |
| `isSvg`   | `boolean`                                                | SVG かどうか                                                                  |
| `retina`  | `{ src: string, width: number, height: number } \| null` | `@2x` 画像が存在する場合に自動検出                                            |
| `variant` | `{ src: string, width: number, height: number } \| null` | `imageInfo.artDirectionSuffix` に応じて検出したアートディレクション画像       |

```pug
- const info = imageInfo('/assets/img/hero.jpg')
//- retina srcset
- const srcset = info.retina ? `${info.src} 1x, ${info.retina.src} 2x` : undefined
//- アートディレクション
if info.variant
  source(media='(max-width: 767px)' srcset=info.variant.src width=info.variant.width height=info.variant.height)
```

> `imageInfo()` は `src/` 配下の画像のみ対応しています。`public/` 配下の画像は非対応です。

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

ビルド時に `src/` 配下の画像（JPEG・PNG）を自動的に最適化します。

- `'avif'` - PNG/JPEGをAVIFに変換
- `'webp'` - PNG/JPEGをWebPに変換
- `'compress'` - 元の形式を維持したまま圧縮
- `false` - 最適化を無効化

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

### Image Benchmark

`pugkit bench` は `src/` 配下の画像を現在の `imageOptimization` 設定でシミュレートし、`benchmark.image.threshold` を超えるファイルを検出・報告します。ビルドは行わずメモリ上で処理するため、実ファイルへの影響はありません。

```sh
# src/ 全体をスキャン
pugkit bench

# ディレクトリ指定
pugkit bench src/assets/img/top/

# 単一ファイル指定
pugkit bench src/assets/img/hero.jpg
```

閾値を超えた画像に対して、qualityを変化させたシミュレーション結果と、閾値以内で品質を最大限維持できるqualityの推奨値を表示します。

```
⚠ 1 image(s) exceed threshold (300KB) with current config
──────────────────────────┬─────────┬──────────
 file                     │ format  │     size
──────────────────────────┼─────────┼──────────
 assets/img/top/kv@2x.jpg │ webp    │   490 KB
──────────────────────────┴─────────┴──────────

Simulation: assets/img/top/kv@2x.jpg  (original: 2.62 MB  2800×1576)
 format: webp  (effort / other options follow config)
─────────┬───────────┬───────────┬────────
 quality │      size │     ratio │ budget
─────────┼───────────┼───────────┼────────
      90 │    490 KB │      -82% │ ⚠  ← current
      40 │    132 KB │      -95% │ ✔
      80 │    268 KB │      -90% │ ✔
─────────┴───────────┴───────────┴────────
★ Recommended: quality 80  →  268 KB (-90%)
```

`pugkit.config.mjs` で閾値やシミュレーション範囲を設定できます。

```js
export default defineConfig({
  benchmark: {
    image: {
      threshold: '300KB', // 警告を出す上限サイズ
      qualityMin: 50, // シミュレーション quality の最小値
      qualityMax: 90, // シミュレーション quality の最大値
      qualityStep: 10 // quality のステップ幅
    }
  }
})
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

`public/` に置いたファイルはそのまま `outDir` のルートにコピーされます。faviconやOGP画像など最適化不要なファイルの置き場として使用します。

### Debug Mode

`debug: true` のとき、開発モードでのみ以下の出力に切り替わります。

| 対象 | 通常                         | debug: true                    |
| ---- | ---------------------------- | ------------------------------ |
| CSS  | minify済み                   | expanded + ソースマップ        |
| JS   | minify済み・`console.*` 削除 | ソースマップ・`console.*` 保持 |

## Tech Stack

- [Pug](https://pugjs.org/) - HTMLテンプレートエンジン
- [Sass](https://sass-lang.com/) - CSSプリプロセッサー
- [esbuild](https://esbuild.github.io/) - TypeScript/JavaScriptバンドラー
- [PostCSS](https://postcss.org/) - CSS後処理（Autoprefixer、cssnano）
- [Sharp](https://sharp.pixelplumbing.com/) - 画像最適化
- [SVGO](https://svgo.dev/) - SVG最適化
- [Chokidar](https://github.com/paulmillr/chokidar) - ファイル監視
- [sirv](https://github.com/lukeed/sirv) + SSE（Server-Sent Events） - 開発サーバー
