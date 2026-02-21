# pugkit

## About

pugkitは静的サイト制作に特化したビルドツールです。
納品向きの綺麗なHTMLと、ファイル構成に制約のないアセットファイルを出力可能です。

## Installation

```bash
npm install pugkit
```

## Usage

### Development Mode

ファイルの変更を監視し、ブラウザの自動リロードを行います。

```bash
pugkit
# or
pugkit dev
# or
pugkit watch
```

### Production Build

製品用ファイルを生成します。

```bash
pugkit build
```

### SVG Sprite Generation

アイコン用のSVGスプライトを生成します。

```bash
pugkit sprite
```

## Configuration

プロジェクトのルートに `pugkit.config.mjs` を配置することで、ビルド設定をカスタマイズできます。

```js
// pugkit.config.mjs
export default {
  siteUrl: 'https://example.com/',
  subdir: 'subdirectory',
  debug: false,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    imageOptimization: 'webp', // 'webp' | 'compress' | false
    imageOptions: {
      webp: {
        quality: 90,
        effort: 6
      },
      jpeg: {
        quality: 75,
        progressive: true
      },
      png: {
        quality: 85,
        compressionLevel: 6
      }
    }
  }
}
```

### Configuration Options

| Option                    | Description                      | Default       |
| ------------------------- | -------------------------------- | ------------- |
| `debug`                   | デバッグモード（開発時のみ有効） | `false`       |
| `server.port`             | 開発サーバーのポート番号         | `5555`        |
| `server.host`             | 開発サーバーのホスト             | `'localhost'` |
| `server.startPath`        | サーバー起動時に開くパス         | `'/'`         |
| `server.open`             | サーバー起動時にブラウザを開く   | `false`       |
| `build.imageOptimization` | 画像最適化の方式                 | `'webp'`      |
| `build.imageOptions`      | 画像最適化の詳細設定             | -             |

## Features

### Pug Templates

Pugテンプレート内では、`Builder` オブジェクトと `imageInfo()` 関数が使用できます。

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

#### imageInfo() Function

`src/` 配下の画像のメタデータ・パスを自動解決します。`imageOptimization` の設定に応じて `src` が自動的に最適化後のパスに変換されます。`basename@2x.ext` / `basename_sp.ext` が存在する場合は retina・SP 情報も自動取得します。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
img(src=info.src width=info.width height=info.height alt='')
```

**返り値**

| Property       | Type                             | Description                                             |
| -------------- | -------------------------------- | ------------------------------------------------------- |
| `src`          | `string`                         | 最適化設定に応じたパス（webpモード時は `.webp` パス）   |
| `width`        | `number \| undefined`            | 画像の幅（px）                                          |
| `height`       | `number \| undefined`            | 画像の高さ（px）                                        |
| `format`       | `string \| undefined`            | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）   |
| `isSvg`        | `boolean`                        | SVG かどうか                                            |
| `retina`       | `{ src: string } \| null`        | `@2x` 画像が存在する場合に自動検出                      |
| `sp`           | `{ src, width, height } \| null` | `_sp` 画像が存在する場合に自動検出                      |

**使用例**

```pug
- const info = imageInfo('/assets/img/hero.jpg')

//- retina 対応
img(
  src=info.src
  srcset=info.retina ? `${info.src} 1x, ${info.retina.src} 2x` : undefined
  width=info.width
  height=info.height
  alt=''
)

//- SP 画像対応
picture
  if info.sp
    source(media='(max-width: 767px)' srcset=info.sp.src width=info.sp.width height=info.sp.height)
  img(src=info.src width=info.width height=info.height alt='')
```

> **Note:** `imageInfo()` は `src/` 配下の画像のみ対応しています。`public/` 配下の画像は非対応です。

### Image Optimization

ビルド時に自動的に画像を最適化します。

- `imageOptimization: 'webp'` - PNG/JPEGをWebP形式に変換
- `imageOptimization: 'compress'` - 元の形式を維持したまま圧縮
- `imageOptimization: false` - 最適化を無効化

### File Naming Rules

- `_`（アンダースコア）で始まるファイルは部分テンプレートとして扱われます
- `_`で始まるディレクトリ内のファイルもビルド対象外です
- 通常のファイル名のみがビルドされます

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
- [sirv](https://github.com/lukeed/sirv) - 開発サーバー
- SSE（Server-Sent Events） - ライブリロード
- [Prettier](https://prettier.io/) - HTML整形

## License

MIT
