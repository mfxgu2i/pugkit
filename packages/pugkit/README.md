# @a-tokuhara/builder (pugkit)

静的サイト生成のためのビルドツールです。
Pug、Sass、TypeScript/Javascript、画像最適化、SVG処理などをサポートしています。

## 使用方法

### インストール

このパッケージはワークスペース内のプライベートパッケージとして管理されています。
プロジェクトのルートで依存関係をインストールしてください。

```sh
npm install
```

### コマンド

パッケージ内で `pugkit` コマンドが使用可能になります。

#### 監視モード（開発）

ファイルの変更を監視し、ブラウザの自動リロードを行います。

```sh
pugkit
# または
pugkit dev
# または
pugkit watch
```

#### 本番ビルド

最適化されたファイルを生成します。

```sh
pugkit build
```

#### SVGスプライト生成

アイコン用のSVGスプライトを生成します。

```sh
pugkit sprite
```

#### ヘルプ表示

利用可能なコマンドを確認できます。

```sh
pugkit --help
```

## 設定

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
    imageOptimization: 'webp', // 'webp' | 'compress'
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

### 設定オプション

| オプション                | 説明                                                       | デフォルト値  |
| ------------------------- | ---------------------------------------------------------- | ------------- |
| `debug`                   | デバッグモード（開発時のみ有効）                           | `false`       |
| `server.port`             | 開発サーバーのポート番号                                   | `5555`        |
| `server.host`             | 開発サーバーのホスト                                       | `'localhost'` |
| `server.startPath`        | サーバー起動時に開くパス                                   | `'/'`         |
| `server.open`             | サーバー起動時にブラウザを開く                             | `false`       |
| `server.host`             | 開発サーバーのホスト                                       | `'localhost'` |
| `server.startPath`        | サーバー起動時に開くパス                                   | `'/'`         |
| `build.imageOptimization` | 画像最適化の方式（`'webp'`: WebP変換、`'compress'`: 圧縮） | `'webp'`      |
| `build.imageOptions`      | 画像最適化の詳細設定（下記参照）                           | -             |

#### 画像最適化オプション（`build.imageOptions`）

画像最適化の詳細設定をカスタマイズできます。各オプションの詳細は、以下のライブラリドキュメントを参照してください：

- **WebP**: [Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)
- **JPEG**: [Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)
- **PNG**: [Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)

## 利用技術

- [Pug](https://pugjs.org/) - HTMLテンプレートエンジン
- [Sass](https://sass-lang.com/) - CSSプリプロセッサー
- [esbuild](https://esbuild.github.io/) - TypeScript/JavaScriptバンドラー
- [PostCSS](https://postcss.org/) - CSS後処理（Autoprefixer、cssnano）
- [Sharp](https://sharp.pixelplumbing.com/) - 画像最適化
- [SVGO](https://svgo.dev/) - SVG最適化
- [Chokidar](https://github.com/paulmillr/chokidar) - ファイル監視
- [BrowserSync](https://browsersync.io/) - 開発サーバー
- [Prettier](https://prettier.io/) - HTML整形適化
- [SVGO](https://svgo.dev/) - SVG最適化

## ディレクトリ構成

```
プロジェクトルート/
├── src/               # ソースファイル
│   ├── *.pug
│   ├── *.scss
│   ├── *.ts
│   ├── *.js
│   └── *.svg
├── public/           # 静的ファイル（内容がそのままコピーされます）
│   ├── ogp.jpg
│   └── favicon.ico
├── dist/             # ビルド出力先
└── builder.config.mjs # ビルド設定ファイル
```

## 画像最適化について

ビルド時に自動的に画像が最適化されます。

- `imageOptimization: 'webp'`: PNG/JPEGをWebP形式に変換します（ファイルサイズを大幅に削減）
- `imageOptimization: 'compress'`: 元の形式を維持したまま画像を圧縮します
- `imageOptimization: false`: 画像最適化を無効化します

> **Note**: 最適化せずにそのままコピーしたい画像は`public`フォルダに配置してください。

## ファイル命名規則(Pug, Sass, TypeScript/Javascript)

- `_`（アンダースコア）で始まるファイルは部分テンプレートとして扱われ、直接ビルド対象になりません
- `_`で始まるディレクトリ内のファイルもビルド対象外です
- 通常のファイル名（アンダースコアで始まらない）のみがビルドされます

## Pugテンプレート機能

Pugテンプレート内では、以下の機能が使用できます。

### `Builder`オブジェクト

各Pugファイルで自動的に利用可能なグローバル変数です。ページのパスやURLに関する情報を提供します。

```pug
//- 相対パスでリンク
a(href=`${Builder.dir}about/`)

//- 完全なURL
meta(property='og:url', content=Builder.url.href)
```

#### `Builder`のプロパティ

| プロパティ             | 説明                                                | 例                                        |
| ---------------------- | --------------------------------------------------- | ----------------------------------------- |
| `Builder.dir`          | 現在のページからルートへの相対パス                  | `./` または `../` または `../../`         |
| `Builder.subdir`       | サブディレクトリのパス（先頭に`/`付き）             | `/subdirectory` または空文字列            |
| `Builder.url.origin`   | サイトのオリジン（末尾の`/`なし）                   | `https://example.com`                     |
| `Builder.url.base`     | サイトのベースURL（origin + subdir、末尾の`/`なし） | `https://example.com/subdirectory`        |
| `Builder.url.pathname` | 現在のページのパス（先頭に`/`付き）                 | `/about/` または `/news/article.html`     |
| `Builder.url.href`     | 完全なURL                                           | `https://example.com/subdirectory/about/` |

**使い分け**:

- **絶対パスでアセットを参照する場合**: `Builder.url.base`を使用
- **ドメインのみが必要な場合**: `Builder.url.origin`を使用

```pug
//- ベースURLを使った絶対パス
link(rel='icon', href=`${Builder.url.base}/favicon.ico`)
meta(property='og:image', content=`${Builder.url.base}/assets/img/ogp.jpg`)
```

### `imageSize()`関数

画像ファイルのサイズ（幅と高さ）を自動取得します。`width`と`height`属性を設定することで、CLS（Cumulative Layout Shift）を防ぎ、ページのパフォーマンスを向上させます。

```pug
//- 絶対パス（srcディレクトリからの相対）
- const size = imageSize('/assets/img/photo.jpg')
img(src='/assets/img/photo.jpg', width=size.width, height=size.height, alt='')

//- 相対パス（現在のPugファイルからの相対）
- const logoSize = imageSize('../img/logo.png')
img(src='../img/logo.png', width=logoSize.width, height=logoSize.height, alt='Logo')
```

## パッケージ構成

```
@a-tokuhara/builder/
├── index.mjs            # JavaScript API
├── package.json
├── cli/                 # CLIコマンド
│   ├── index.mjs        # エントリーポイント
│   ├── build.mjs        # ビルドコマンド
│   ├── develop.mjs      # 開発コマンド
│   ├── sprite.mjs       # スプライトコマンド
│   └── logger.mjs       # CLI用ロガー
├── config/              # 設定管理
│   ├── defaults.mjs     # デフォルト設定
│   ├── define.mjs       # 設定定義
│   ├── index.mjs        # 設定ローダー
│   ├── main.mjs         # メイン設定処理
│   └── patterns.mjs     # Globパターン
├── core/                # コア機能
│   ├── builder.mjs      # ビルダー本体
│   ├── cache.mjs        # キャッシュ管理
│   ├── context.mjs      # ビルドコンテキスト
│   ├── graph.mjs        # 依存関係グラフ
│   ├── server.mjs       # 開発サーバー
│   └── watcher.mjs      # ファイル監視
├── generate/            # ファイル生成
│   ├── asset.mjs        # アセット生成
│   └── page.mjs         # ページ生成
├── tasks/               # ビルドタスク
│   ├── copy.mjs         # ファイルコピー
│   ├── image.mjs        # 画像最適化
│   ├── pug.mjs          # Pugビルド
│   ├── sass.mjs         # Sassビルド
│   ├── script.mjs       # TypeScript/JSビルド
│   ├── svg-sprite.mjs   # SVGスプライト生成
│   └── svg.mjs          # SVG最適化
├── transform/           # 変換処理
│   ├── builder-vars.mjs # Builder変数生成
│   ├── html.mjs         # HTML整形
│   ├── image-size.mjs   # 画像サイズ取得
│   └── pug.mjs          # Pugコンパイル
└── utils/               # ユーティリティ
    ├── file.mjs         # ファイル操作
    └── logger.mjs       # ログ出力
```

## ライセンス

Private
