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

Node.js 22.22.2 以上が必要です。

```sh
$ npm install --save-dev pugkit
$ touch ./src/index.pug
```

`package.json` にスクリプトを追加します。

```json
"scripts": {
  "start": "pugkit",
  "build": "pugkit build",
  "check": "pugkit check",
  "sprite": "pugkit sprite"
}
```

## Commands

| コマンド        | エイリアス                    | 内容                          |
| --------------- | ----------------------------- | ----------------------------- |
| `pugkit`        | `pugkit dev` / `pugkit watch` | 開発モード（Ctrl + C で停止） |
| `pugkit build`  | -                             | 本番ビルド                    |
| `pugkit check`  | -                             | ビルド済みの出力を検査        |
| `pugkit sprite` | -                             | SVGスプライト生成             |

### Options

設定ファイルの値を、その実行の間だけ上書きします。

| オプション         | 対象コマンド   | 上書きする設定 |
| ------------------ | -------------- | -------------- |
| `--port <port>`    | `pugkit`       | `server.port`  |
| `--host <host>`    | `pugkit`       | `server.host`  |
| `--site-url <url>` | `pugkit build` | `siteUrl`      |

```sh
pugkit --port 3000
pugkit build --site-url https://example.com/
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

### File Naming Rules

`src/` から出力されるのは、いずれかのタスクが担当する拡張子だけです。ディレクトリ構成は維持したまま `outDir`（デフォルト: `dist/`）に出力されます。

```
src/foo/style.scss →  dist/foo/style.css
src/foo/bar/script.js  →  dist/foo/bar/script.js
```

| 拡張子                             | 担当   |
| ---------------------------------- | ------ |
| `.pug`                             | pug    |
| `.scss`                            | sass   |
| `.ts` / `.js`                      | script |
| `.jpg` / `.jpeg` / `.png` / `.gif` | image  |
| `.svg`                             | svg    |

これ以外のファイルは出力されません。フォント・JSON・`.css`・`.webp` などを `src/` に置いても無視されます（`.webp` と `.avif` だけはビルド時に警告が出ます）。これらは `public/` に置いてください。

`_`（アンダースコア）で始まるファイル・ディレクトリはビルド対象外です。

`public/` にはどちらの規則も適用されません。ドットファイルを含め、置いたものがすべてコピーされます。

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
    image: {
      // 'avif' | 'webp' | 'compress'
      format: 'webp',
      // src の画像を何倍の原本として扱うか
      sourceDensity: 2
    },
    html: {
      indent_size: 2,
      wrap_line_length: 0
    }
  }
})
```

指定しなかった項目はデフォルト値が使われます。全項目は次の表を参照してください。

| Option                           | Description                                                                                                                                  | Type / Values                        | Default       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------- |
| `siteUrl`                        | サイトのベースURL（`Builder.url` に使用）                                                                                                    | `string`                             | `''`          |
| `subdir`                         | サイトを配置するサブディレクトリ。出力先が `outDir/<subdir>/` になり、dev の URL にも付く。`Builder.subdir` / `Builder.url` にも反映される   | `string`                             | `''`          |
| `outDir`                         | build の出力先ディレクトリ。相対・絶対パス・ネスト（`htdocs/v2`）・上位（`../htdocs`）も指定可。dev は書き込まない。指定できる場所に制限あり | `string`                             | `'dist'`      |
| `cacheDir`                       | dev のアセット出力先。`null` で `node_modules/.pugkit/dev`（`node_modules` が無ければ `.pugkit/dev`）。指定先は dev 起動のたびに作り直される | `string` \| `null`                   | `null`        |
| `server.port`                    | 開発サーバーのポート番号                                                                                                                     | `number`                             | `5555`        |
| `server.host`                    | 開発サーバーのホスト                                                                                                                         | `string`                             | `'localhost'` |
| `server.startPath`               | 起動ログに表示する URL のパス                                                                                                                | `string`                             | `'/'`         |
| `server.domDiff`                 | ライブリロードで DOM の差分適用を使うか（`false` で常にフルリロード）                                                                        | `boolean`                            | `true`        |
| `build.image.format`             | 画像の出力形式                                                                                                                               | `'avif'` \| `'webp'` \| `'compress'` | `'webp'`      |
| `build.image.sourceDensity`      | `src/` の画像を何倍の原本として扱うか。`2` なら等倍版を生成して `srcset` を出す。`imageInfo()` に `widths` を渡した画像には効かない          | `1` \| `2`                           | `2`           |
| `build.image.options.avif`       | AVIF変換オプション（[Sharp AVIF options](https://sharp.pixelplumbing.com/api-output#avif)）                                                  | `object`                             | 下記          |
| `build.image.options.webp`       | WebP変換オプション（[Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)）                                                  | `object`                             | 下記          |
| `build.image.options.jpeg`       | JPEG圧縮オプション（[Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)）                                                  | `object`                             | 下記          |
| `build.image.options.png`        | PNG圧縮オプション（[Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)）                                                     | `object`                             | 下記          |
| `build.image.artDirectionSuffix` | アートディレクション用画像のサフィックス（`_sp`, `_tb`, `_pc` など）                                                                         | `string`                             | `'_sp'`       |
| `build.image.overrides`          | 特定画像に個別のSharpオプションを適用（グローバルオプションに上書きマージ）                                                                  | `Record<string, object>`             | `{}`          |
| `build.html`                     | HTML整形オプション（[js-beautify html options](https://github.com/beautify-web/js-beautify#options)）                                        | `object`                             | 下記          |

### 既定値

`build.image.options.*` と `build.html` は形式ごとに浅くマージされます。一部だけ指定すれば、残りは次の値のままです。

```js
build: {
  image: {
    options: {
      webp: { quality: 80, effort: 4, smartSubsample: true, alphaQuality: 100, lossless: false },
      jpeg: { quality: 75, progressive: true, mozjpeg: false },
      png: { quality: 85, compressionLevel: 6, adaptiveFiltering: true, palette: true },
      avif: { quality: 70, lossless: false, effort: 4, chromaSubsampling: '4:4:4' }
    }
  },
  html: {
    indent_size: 2,
    indent_with_tabs: false,
    max_preserve_newlines: 1,
    preserve_newlines: false,
    end_with_newline: true,
    extra_liners: [],
    wrap_line_length: 0,
    content_unformatted: ['script', 'style', 'pre', 'textarea']
  }
}
```

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

`origin` / `base` / `href` は `siteUrl` から組み立てます。`siteUrl` が空のままこれらを参照すると、`/about/` のような相対パスが返ります。OGP や canonical に入れても例外にならないため、参照されたときに知らせます。

```
⚠ config siteUrl が空のまま Builder.url を参照しています: index.pug。OGP や canonical に相対パスが入ります
```

共通レイアウトから参照していてもページ数だけ並ばないよう、1回の実行につき1度だけ出ます。相対リンクしか使わない場合は `Builder.dir` と `Builder.url.pathname` だけを触るので、この警告は出ません。

#### imageInfo()

`src/` 配下の画像のパスと寸法を返します。パスは `build.image.format` に応じた変換後のもので、`srcset` も組み立てます。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
img(src=info.src srcset=info.srcset width=info.width height=info.height alt='')
```

第2引数で幅を指定できます。指定しなければ `build.image.sourceDensity` に応じた密度記述子になります。

```pug
- const info = imageInfo('/assets/img/hero.jpg', { widths: [400, 800, 1200], sizes: '(max-width: 768px) 100vw, 800px' })
img(src=info.src srcset=info.srcset sizes=info.sizes width=info.width height=info.height alt='')
```

| Option   | Type       | Description                                                                            |
| -------- | ---------- | -------------------------------------------------------------------------------------- |
| `widths` | `number[]` | 生成する幅の一覧。指定すると `srcset` が幅記述子になる。正の整数以外は除外して警告する |
| `sizes`  | `string`   | 表示幅の指定。そのまま返るので `sizes` 属性に渡す。`widths` と組で使う                 |

| Property  | Type                                            | Description                                                           |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `src`     | `string`                                        | 密度モードは表示サイズ側、幅モードは原寸のパス                        |
| `width`   | `number \| undefined`                           | 密度モードは表示サイズの幅、幅モードは原寸の幅（px）                  |
| `height`  | `number \| undefined`                           | 同上（px）                                                            |
| `srcset`  | `string \| undefined`                           | 候補が 2 つ以上あるときだけ返る。画像が見つからない場合も `undefined` |
| `sizes`   | `string \| undefined`                           | 幅記述子の `srcset` を出したときだけ返る                              |
| `format`  | `string \| undefined`                           | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）                  |
| `isSvg`   | `boolean`                                       | SVG かどうか                                                          |
| `variant` | `{ src, width, height, srcset, sizes } \| null` | `build.image.artDirectionSuffix` に応じたアートディレクション画像     |

1600×1200 の `hero.jpg` を置いた場合、2 つのモードの出力はこうなります。

```html
<!-- 密度モード（既定） -->
<img
  src="/assets/img/hero@half.webp"
  srcset="/assets/img/hero@half.webp 1x, /assets/img/hero.webp 2x"
  width="800"
  height="600"
/>

<!-- 幅モード（widths: [400, 800, 1200]） -->
<img
  src="/assets/img/hero.webp"
  srcset="
    /assets/img/hero@400w.webp   400w,
    /assets/img/hero@800w.webp   800w,
    /assets/img/hero@1200w.webp 1200w,
    /assets/img/hero.webp       1600w
  "
  sizes="(max-width: 768px) 100vw, 800px"
  width="1600"
  height="1200"
/>
```

幅モードでは `width` と `height` が原寸になります。CSS で幅を指定してください。`sizes` も必ず渡してください。省くとブラウザは画面いっぱいに表示されるものとみなし、重い候補を選びます。

`srcset` は候補が 2 つ以上のときだけ返ります。1 つのときは `sizes` ごと落ちます。SVG、GIF、`public/` の画像、`sourceDensity: 1`、縮小しても寸法が変わらない画像、指定した幅がすべて原寸以上だった場合が該当します。`variant.srcset` は `<source>` の必須属性なので、候補が 1 つでも返ります。

アートディレクション画像は `variant` に入ります。`widths` は `variant` にも掛かります。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
picture
  if info.variant
    source(media='(max-width: 767px)' srcset=info.variant.srcset width=info.variant.width height=info.variant.height)
  img(src=info.src srcset=info.srcset width=info.width height=info.height alt='')
```

> `imageInfo()` は `src/` を探し、見つからなければ `public/` も探します。`public/` の画像は変換も縮小もされないため、`src` は元のパスのまま返り、`srcset` は返りません。`widths` を渡すと警告が出ます。

### Sass

`src/` 配下の `.scss` ファイルをコンパイルして出力します。コンパイル後は [Lightning CSS](https://lightningcss.dev/) を通し、ベンダープレフィックスの付与、モダン構文の降格、圧縮を行います。

対象ブラウザは [browserslist](https://github.com/browserslist/browserslist) から読みます。プロジェクトルートの `.browserslistrc` か、`package.json` の `browserslist` に書いてください。指定が無ければ browserslist の既定が使われます。

`@use` と `@forward` は `/` 始まりで `src/` からの指定になります。Pug の `include` と同じ書き方です。相対指定もそのまま使えます。

```scss
@use '/sass/tokens'; // src/sass/_tokens.scss
@use '../../sass/tokens'; // 同じファイルを相対で指定
```

パーシャルの `_` と拡張子は補完されます。ディレクトリを指定すると `_index.scss` を読みます。

### JavaScript / TypeScript

`src/` 配下の `.js` / `.ts` ファイルをバンドルして出力します。

`import` も `/` 始まりで `src/` からの指定になります。拡張子は省けます。

```js
import { tag } from '/_lib/util' // src/_lib/util.js
import { tag } from '../../_lib/util.js' // 同じファイルを相対で指定
```

`_` で始まるファイル・ディレクトリはエントリになりません。他から `import` される部品はこの名前にしてください。そうしないと、その部品自体も単体でバンドルされて出力されます。

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
  "sprite": "pugkit sprite"
}
```

### Image Optimization

`src/` 配下の JPEG / PNG / GIF をビルド時に変換します。

| `build.image.format` | 挙動                                 |
| -------------------- | ------------------------------------ |
| `'webp'`             | WebP に変換（既定）                  |
| `'avif'`             | AVIF に変換                          |
| `'compress'`         | 形式を保ったまま圧縮（GIF はコピー） |

> 等倍のまま出したい画像（ロゴ・favicon・OGP など）は `public/` に置いてください。変換も縮小もされません。

> `src/` に置いた `.webp` / `.avif` は出力されません。ビルド時に警告が出ます。

> GIF と SVG は密度・幅記述子の対象外です。

#### 画像は 1 枚だけ置く

`src/` には最大解像度の 1 枚だけを置きます。縮小版はビルドが作るので、`@2x` を用意する必要はありません。

```
src/assets/img/hero.jpg   (1600x1200)
  ↓  sourceDensity: 2
dist/assets/img/hero.webp        (1600x1200)
dist/assets/img/hero@half.webp   ( 800x600)
```

| 設定               | 挙動                                                     |
| ------------------ | -------------------------------------------------------- |
| `sourceDensity: 2` | `@half` を作り、`srcset` に `1x` / `2x` を並べる（既定） |
| `sourceDensity: 1` | 原寸 1 枚だけ。`srcset` は出ない                         |

#### 幅違いの生成

`imageInfo()` に `widths` を渡した画像だけ生成されます。設定項目はありません。

```
src/assets/img/hero.jpg   (1600x1200)
  ↓  widths: [400, 800, 1200]
dist/assets/img/hero.webp        (1600x1200)
dist/assets/img/hero@half.webp   ( 800x600)
dist/assets/img/hero@400w.webp   ( 400x300)
dist/assets/img/hero@800w.webp   ( 800x600)
dist/assets/img/hero@1200w.webp  (1200x900)
```

原寸以上の幅は作られません。`@half` は `widths` を渡した画像にも作られます。

> `@half` と `@<数字>w` はビルドが作る名前です。この形の画像を `src/` や `public/` に置くと build が中止します。

#### 特定画像の個別オプション指定

`build.image.overrides` で画像ごとに圧縮オプションを変えられます。キーは `src/` からの相対パス、値は [Sharp](https://sharp.pixelplumbing.com/api-output) のオプションです。幅違いにも同じ値が掛かります。

```js
build: {
  image: {
    format: 'webp',
    overrides: {
      // 品質を上げたい画像
      'assets/img/bg-hero.jpg': { quality: 100 }
    }
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
    content_unformatted: ['script', 'style', 'pre', 'textarea']
  }
}
```

利用可能なオプションは [js-beautify のドキュメント](https://github.com/beautify-web/js-beautify#options)を参照してください。

### SVG Optimization

`icons/`配下以外に配置した SVG ファイルはSVGOで自動最適化されて出力されます。

### SVG Sprite

`src/`配下の`icons/`ディレクトリに配置したSVGを1つのスプライトファイルにまとめます。サブディレクトリに分けて置いても、同じ1つのスプライトにまとまります。

```
src/assets/icons/arrow.svg     →  <outDir>/assets/icons.svg#arrow
src/assets/icons/social/x.svg  →  <outDir>/assets/icons.svg#social/x
```

```html
<svg><use href="assets/icons.svg#arrow"></use></svg> <svg><use href="assets/icons.svg#social/x"></use></svg>
```

- `icons/`からの相対パスから拡張子を除いたものが `<symbol id>` になります。直下に置いたSVGはファイル名がそのまま id です
- スプライトのアイコンは単色として扱います。`fill` / `stroke` は `currentColor` に変換されるので、色はCSSから当ててください。元のSVGが持っていた色は残りません
- グラデーションのように複数の色を使うSVGは、色が保てないのでスプライトに向きません。`icons/`の外に置いて、個別のSVGとして出力してください
- `<symbol>` は id の昇順で並びます。同じ入力なら環境が変わっても同じ内容が出ます
- `icons.svg` はスプライトの出力に使う名前です。`src/` と `public/` に同じ名前のファイルがあると `build` を中止します

### Public Directory

- `public/` に置いたファイルは、ディレクトリ構成を保ったまま出力先へコピーされます（`subdir` を指定している場合はその配下）。変換も縮小もされないので、favicon・OGP画像のほか、等倍のまま出したい画像の置き場としても使います。

- `src/` と `public/` で同じ出力先になるファイルがあった場合は、どちらが残るかが決まらないため `build` を中止します。どちらか一方を削除してください。`dev` は起動時に検査してログに出しますが、起動は続けます。

- `@half` と `@<数字>w` で終わる画像も同じ扱いで中止します。これはビルドが縮小版と幅違いに使う名前で、幅違いの出力先は事前に列挙できないため、名前を予約することで衝突を防いでいます。

- `icons.svg` も同じ扱いで中止します。スプライトの出力に使う名前で、`icons/` ディレクトリを後から足したときに黙って取り合わないよう、ディレクトリの有無に関わらず予約しています。

### Dev / Build の出力の違い

| 対象   | dev                                           | build                        |
| ------ | --------------------------------------------- | ---------------------------- |
| HTML   | リクエスト時ビルド + メモリ配信               | 全ページビルドして書き出し   |
| CSS    | expanded + ソースマップ                       | minify済み                   |
| JS     | ソースマップ・`console.*` 保持                | minify済み・`console.*` 削除 |
| 出力先 | `cacheDir`（既定 `node_modules/.pugkit/dev`） | `outDir`                     |

> `outDir` は build 専用です。dev は `outDir` に書き込みも読み出しもしないため、dev のソースマップ等が本番成果物に混ざりません。

> `outDir` は pugkit が占有します。build のたびに中身を削除してから書き出すので、手で置いたファイル（`.htaccess`・PHP・アップロード等）は残りません。出力に含めたいものは `public/` に置いてください。

### 出力の検査

`pugkit check` はビルド済みの出力を検査します。ビルドはしないので、出力ディレクトリが無ければ中止します。あっても中身が空なら、検査対象が無かったことを表示します。

```sh
pugkit build && pugkit check
```

検査項目は引数で選べます。指定しなければ全項目を実行します。

| 項目         | 内容                                                    |
| ------------ | ------------------------------------------------------- |
| `references` | HTML と CSS に書かれた参照が出力に実在するか            |
| `markup`     | 出力 HTML が HTML として妥当か（markuplint に渡します） |

```sh
pugkit check                     # 全部
pugkit check references          # 参照の実在だけ
```

違反が 1 件でもあれば終了コード `1` を返します。markuplint が `warning` や `info` に落としたルールも同じ扱いです。重さは表示の色で分けますが、終了コードは変えません。落としたいルールは markuplint の設定で切ってください。

`markup` は markuplint に依存します。入っていなければ検査せずに知らせるので、使う場合は入れてください。

```sh
$ npm install --save-dev markuplint
```

### エラー表示

CLI が異常終了したときは、原因のメッセージだけを表示して終了コード `1` を返します。設定ミスや出力先の衝突など、ソースを直せば済むエラーがスタックトレースに埋もれないようにするためです。

pugkit 自身の不具合を調べたい場合は `PUGKIT_DEBUG=1` を付けるとスタックトレースが出ます。

```sh
PUGKIT_DEBUG=1 npx pugkit build
```

## AI Agent Skill

pugkitの規約をAIコーディングエージェントに伝える公式の[Agent Skill](https://github.com/agentskills/agentskills)を提供しています。`Builder`によるパスの組み立て、`imageInfo()`を通した画像の出力、`_`によるビルド対象の除外といった、知らないと壊れる仕様をエージェントに守らせます。

`npm create pugkit@latest` で作成したプロジェクトには `.claude/skills/pugkit/`（Claude Code）と `.github/skills/pugkit/`（GitHub Copilot）へ同梱されます。既存のプロジェクトに追加する場合は次のコマンドを使います。

```sh
$ npx skills add mfxgu2i/pugkit
```

## Tech Stack

| ライブラリ                                                           | 役割                                 |
| -------------------------------------------------------------------- | ------------------------------------ |
| [Pug](https://pugjs.org/)                                            | HTMLテンプレートエンジン             |
| [Sass](https://sass-lang.com/)                                       | CSSプリプロセッサー                  |
| [esbuild](https://esbuild.github.io/)                                | TypeScript/JavaScriptバンドラー      |
| [Lightning CSS](https://lightningcss.dev/)                           | CSS後処理（プレフィックス・圧縮）    |
| [Sharp](https://sharp.pixelplumbing.com/)                            | 画像最適化                           |
| [SVGO](https://svgo.dev/)                                            | SVG最適化                            |
| [js-beautify](https://github.com/beautify-web/js-beautify)           | HTML整形                             |
| [Chokidar](https://github.com/paulmillr/chokidar)                    | ファイル監視                         |
| [sirv](https://github.com/lukeed/sirv)                               | 静的配信（開発サーバー、SSE と併用） |
| [image-dimensions](https://github.com/sindresorhus/image-dimensions) | 画像の寸法の読み取り                 |
| [idiomorph](https://github.com/bigskysoftware/idiomorph)             | ライブリロードの DOM 差分適用        |
| [htmlparser2](https://github.com/fb55/htmlparser2)                   | 出力 HTML からの参照の収集           |

[markuplint](https://markuplint.dev/) は optional peer dependency です。`pugkit check markup` を使う場合だけプロジェクトに入れてください。使わないプロジェクトに `@markuplint/*` と HTML 仕様データを持ち込まないよう、pugkit の依存には含めていません。
