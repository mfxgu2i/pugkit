# pugkit

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/pugkit">
    <img alt="" src="https://img.shields.io/npm/v/pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
  <a aria-label="License" href="https://github.com/mfxgu2i/pugkit/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
</p>

## About

pugkitは静的サイト制作に特化したビルドツールです。
納品向きの綺麗なHTMLと、ファイル構成に制約のないアセットファイルを出力可能です。

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

| コマンド        | 内容                          |
| --------------- | ----------------------------- |
| `pugkit`        | 開発モード（Ctrl + C で停止） |
| `pugkit build`  | 本番ビルド                    |
| `pugkit sprite` | SVGスプライト生成             |

## Configuration

プロジェクトルートに`pugkit.config.mjs`を配置することで、ビルド設定をカスタマイズできます。

```js
// pugkit.config.mjs
import { defineConfig } from 'pugkit'

export default defineConfig({
  siteUrl: 'https://example.com/',
  subdir: '',
  debug: false,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    imageOptimization: 'webp'
  }
})
```

| Option                    | Description                                                                                 | Type / Values                       | Default       |
| ------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- | ------------- |
| `siteUrl`                 | サイトのベースURL（`Builder.url` に使用）                                                   | `string`                            | `''`          |
| `subdir`                  | サブディレクトリのパス                                                                      | `string`                            | `''`          |
| `debug`                   | デバッグモード（開発時のみ有効）                                                            | `boolean`                           | `false`       |
| `server.port`             | 開発サーバーのポート番号                                                                    | `number`                            | `5555`        |
| `server.host`             | 開発サーバーのホスト                                                                        | `string`                            | `'localhost'` |
| `server.startPath`        | サーバー起動時に開くパス                                                                    | `string`                            | `'/'`         |
| `server.open`             | サーバー起動時にブラウザを開く                                                              | `boolean`                           | `false`       |
| `build.imageOptimization` | 画像最適化の方式                                                                            | `'webp'` \| `'compress'` \| `false` | `'webp'`      |
| `build.imageOptions.webp` | WebP変換オプション（[Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)） | `object`                            | -             |
| `build.imageOptions.jpeg` | JPEG圧縮オプション（[Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)） | `object`                            | -             |
| `build.imageOptions.png`  | PNG圧縮オプション（[Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)）    | `object`                            | -             |

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

`src/` 配下の画像のメタデータを取得します。`imageOptimization` の設定に応じて `src` が最適化後のパスに変換され、`@2x`/`_sp` 画像が存在する場合も自動的に解決されます。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
img(src=info.src width=info.width height=info.height alt='')
```

| Property | Type                             | Description                                           |
| -------- | -------------------------------- | ----------------------------------------------------- |
| `src`    | `string`                         | 最適化設定に応じたパス（webpモード時は `.webp` パス） |
| `width`  | `number \| undefined`            | 画像の幅（px）                                        |
| `height` | `number \| undefined`            | 画像の高さ（px）                                      |
| `format` | `string \| undefined`            | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）  |
| `isSvg`  | `boolean`                        | SVG かどうか                                          |
| `retina` | `{ src: string } \| null`        | `@2x` 画像が存在する場合に自動検出                    |
| `sp`     | `{ src, width, height } \| null` | `_sp` 画像が存在する場合に自動検出                    |

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

- `'webp'` - PNG/JPEGをWebPに変換
- `'compress'` - 元の形式を維持したまま圧縮
- `false` - 最適化を無効化

### SVG Sprite

`src/` 配下の `icons/` ディレクトリに配置したSVGを1つのスプライトファイルにまとめます。

```
src/assets/icons/arrow.svg  →  dist/assets/icons.svg#arrow
```

```html
<svg><use href="assets/icons.svg#arrow"></use></svg>
```

- SVG ファイル名がそのまま `<symbol id>` になります
- `fill` / `stroke` は自動的に `currentColor` に変換されます

### SVG Optimization

`icons/` 以外に配置した SVG ファイルは SVGO で自動最適化されて出力されます。

### Public Directory

`public/` に置いたファイルはそのまま `dist/` のルートにコピーされます。faviconやOGP画像など最適化不要なファイルの置き場として使用します。

### Debug Mode

`debug: true` のとき、開発モードでのみ以下の出力に切り替わります。

| 対象 | 通常                         | debug: true                    |
| ---- | ---------------------------- | ------------------------------ |
| CSS  | minify済み                   | expanded + ソースマップ        |
| JS   | minify済み・`console.*` 削除 | ソースマップ・`console.*` 保持 |

### File Naming Rules

`_`（アンダースコア）で始まるファイル・ディレクトリはビルド対象外です。それ以外のファイルは `src/` 配下のディレクトリ構成を維持したまま `dist/` に出力されます。

```
src/foo/style.scss →  dist/foo/style.css
src/foo/bar/script.js  →  dist/foo/bar/script.js
```

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

## Tech Stack

- [Pug](https://pugjs.org/) - HTMLテンプレートエンジン
- [Sass](https://sass-lang.com/) - CSSプリプロセッサー
- [esbuild](https://esbuild.github.io/) - TypeScript/JavaScriptバンドラー
- [PostCSS](https://postcss.org/) - CSS後処理（Autoprefixer、cssnano）
- [Sharp](https://sharp.pixelplumbing.com/) - 画像最適化
- [SVGO](https://svgo.dev/) - SVG最適化
- [Chokidar](https://github.com/paulmillr/chokidar) - ファイル監視
- [sirv](https://github.com/lukeed/sirv) + SSE（Server-Sent Events） - 開発サーバー
