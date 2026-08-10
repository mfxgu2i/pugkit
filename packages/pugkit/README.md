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

Node.js 22 以上が必要です。

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

| コマンド        | エイリアス                    | 内容                          |
| --------------- | ----------------------------- | ----------------------------- |
| `pugkit`        | `pugkit dev` / `pugkit watch` | 開発モード（Ctrl + C で停止） |
| `pugkit build`  | -                             | 本番ビルド                    |
| `pugkit sprite` | -                             | SVGスプライト生成             |

いずれも第1引数でプロジェクトルートを指定できます（デフォルトはカレントディレクトリ）。

```sh
pugkit build ./path/to/project
```

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

`src/` では `_`（アンダースコア）で始まるファイル・ディレクトリがビルド対象外です。それ以外のファイルは `src/` 配下のディレクトリ構成を維持したまま `outDir`（デフォルト: `dist/`）に出力されます。

`public/` にはこの規則が適用されません。ドットファイルを含め、置いたものがすべてコピーされます。

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

| Option                           | Description                                                                                                                                          | Type / Values                        | Default       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------- |
| `siteUrl`                        | サイトのベースURL（`Builder.url` に使用）                                                                                                            | `string`                             | `''`          |
| `subdir`                         | サイトを配置するサブディレクトリ。出力先が `outDir/<subdir>/` になり、dev の URL にも付く。`Builder.subdir` / `Builder.url` にも反映される           | `string`                             | `''`          |
| `outDir`                         | build の出力先ディレクトリ。相対・絶対パス・ネスト（`htdocs/v2`）・上位（`../htdocs`）も指定可。dev は書き込まない。指定できる場所に制限あり（下記） | `string`                             | `'dist'`      |
| `cacheDir`                       | dev のアセット出力先。`null` で `node_modules/.pugkit/dev`（`node_modules` が無ければ `.pugkit/dev`）。指定先は dev 起動のたびに作り直される（下記） | `string` \| `null`                   | `null`        |
| `server.port`                    | 開発サーバーのポート番号                                                                                                                             | `number`                             | `5555`        |
| `server.host`                    | 開発サーバーのホスト                                                                                                                                 | `string`                             | `'localhost'` |
| `server.startPath`               | 起動ログに表示する URL のパス                                                                                                                        | `string`                             | `'/'`         |
| `server.domDiff`                 | ライブリロードで DOM の差分適用を使うか（`false` で常にフルリロード）                                                                                | `boolean`                            | `true`        |
| `build.image.format`             | 画像の出力形式                                                                                                                                       | `'avif'` \| `'webp'` \| `'compress'` | `'webp'`      |
| `build.image.sourceDensity`      | `src/` の画像を何倍の原本として扱うか。`2` なら等倍版を生成して `srcset` を出す。`imageInfo()` に `widths` を渡した画像には効かない                  | `1` \| `2`                           | `2`           |
| `build.image.options.avif`       | AVIF変換オプション（[Sharp AVIF options](https://sharp.pixelplumbing.com/api-output#avif)）                                                          | `object`                             | -             |
| `build.image.options.webp`       | WebP変換オプション（[Sharp WebP options](https://sharp.pixelplumbing.com/api-output#webp)）                                                          | `object`                             | -             |
| `build.image.options.jpeg`       | JPEG圧縮オプション（[Sharp JPEG options](https://sharp.pixelplumbing.com/api-output#jpeg)）                                                          | `object`                             | -             |
| `build.image.options.png`        | PNG圧縮オプション（[Sharp PNG options](https://sharp.pixelplumbing.com/api-output#png)）                                                             | `object`                             | -             |
| `build.image.artDirectionSuffix` | アートディレクション用画像のサフィックス（`_sp`, `_tb`, `_pc` など）                                                                                 | `string`                             | `'_sp'`       |
| `build.image.overrides`          | 特定画像に個別のSharpオプションを適用（グローバルオプションに上書きマージ）                                                                          | `Record<string, object>`             | `{}`          |
| `build.html`                     | HTML整形オプション（[js-beautify html options](https://github.com/beautify-web/js-beautify#options)）                                                | `object`                             | see below     |

### 設定キーの確認

キーの綴りを間違えても値は既定のままで、ビルドは成功します。それだけでは出力を1つずつ確かめるまで気づけないので、起動時にキーを検査します。

実在しないキーは警告して既定値のまま続けます。

```
⚠ config pugkit.config.mjs に不明なキーがあります（無視されます）: build.imageOptimizatoin
```

v1 から名前が変わったキーは中止します。指定した値が効かないまま出力されるためです。移行先を添えるので、そのまま置き換えてください。

| v1                         | v2                               |
| -------------------------- | -------------------------------- |
| `build.imageOptimization`  | `build.image.format`             |
| `build.imageSourceDensity` | `build.image.sourceDensity`      |
| `build.imageOptions`       | `build.image.options`            |
| `build.imageOverrides`     | `build.image.overrides`          |
| `build.imageInfo`          | `build.image.artDirectionSuffix` |

`build.html`・`build.image.options.*`・`build.image.overrides` の中身は検査しません。js-beautify や Sharp のオプション、利用者のファイル名がそのまま入るためです。

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

`src/` 配下の画像のメタデータを取得します。`build.image.format` に応じて `src` が最適化後のパスに変換され、`srcset` が組み立てられます。アートディレクション画像が存在する場合も自動的に解決されます。

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

`srcset` は候補が 1 つしかないときには返りません。SVG、GIF、`public/` 配下の画像、縮小しても寸法が変わらない画像、`sourceDensity: 1` のプロジェクトの画像、そして幅がすべて剪定された画像が該当します。`sizes` も一緒に落ちます。`variant.srcset` は `<source>` の必須属性なので、候補が 1 つでも必ず返ります。

`widths` を渡したのに `srcset` が返らないときは、指定した幅がすべて原寸以上だった場合です。1600px の画像に `widths: [2000]` を渡すと候補は無印だけになります。このとき `width` と `height` は原寸に切り替わったままなので、CSS で幅を決めていないと表示が変わります。

```pug
- const info = imageInfo('/assets/img/hero.jpg')
picture
  //- アートディレクション
  if info.variant
    source(media='(max-width: 767px)' srcset=info.variant.srcset width=info.variant.width height=info.variant.height)
  img(src=info.src srcset=info.srcset width=info.width height=info.height alt='')
```

`sourceDensity: 2` で 1600×1200 の `hero.jpg` を置いた場合、出力は次のようになります。

```html
<img
  src="/assets/img/hero@half.webp"
  srcset="/assets/img/hero@half.webp 1x, /assets/img/hero.webp 2x"
  width="800"
  height="600"
/>
```

同じ画像に `widths: [400, 800, 1200]` を渡すと次のようになります。

```html
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

アートディレクション画像にも同じ幅が掛かります。`hero_sp.jpg` が 750px なら、`hero_sp@400w.webp` と無印の 2 つが候補になります。原寸を超える幅は落ちるので、指定した幅がそのまま並ぶとは限りません。

#### 幅モードは CSS で幅を決めることが前提です

`widths` を渡すと、`imageInfo()` が返す `width` と `height` は原寸の実寸になります。密度モードでは表示サイズ、つまり原寸を `sourceDensity` で割った値でした。同じ画像に `widths` を足すと、この値が変わります。

`width` と `height` 属性は、アスペクト比だけでなく CSS の `width` と `height` にも写ります。優先度は最も低い扱いなので、スタイルシートが幅を指定していれば必ずそちらが勝ちます。指定していない画像だけが、属性の値そのままの幅で描画されます。

レイアウトシフトは起きません。読み込み前に確保される箱は比率から決まり、比率は実寸から導いているためです。

幅モードを使う画像には、CSS で幅を与えてください。あわせて `sizes` を必ず書いてください。書かないとブラウザは `100vw`、つまり画面いっぱいに表示されるものとして候補を選びます。サムネイルでも全幅想定で選ぶので、密度記述子より重いファイルを取りに行くことになります。

> `imageInfo()` は `src/` 配下を探し、見つからなければ `public/` 配下も探します。
> `public/` の画像は変換も縮小もされないため、`src` は元のパスのまま返り、`srcset` は返りません。`widths` を渡しても効かず、警告が出ます。

### Sass

`src/` 配下の `.scss` ファイルをコンパイルして出力します。コンパイル後は [Lightning CSS](https://lightningcss.dev/) を通し、ベンダープレフィックスの付与、モダン構文の降格、圧縮を行います。

対象ブラウザは [browserslist](https://github.com/browserslist/browserslist) から読みます。プロジェクトルートの `.browserslistrc` か、`package.json` の `browserslist` に書いてください。指定が無ければ browserslist の既定が使われます。

対象ブラウザは付与するプレフィックスだけでなく、構文をどこまで降ろすかも決めます。入れ子・メディアクエリの範囲構文・相対カラー構文などは、未対応のブラウザが対象に含まれていれば古い書き方へ変換されます。

```scss
// 書いたもの
.a {
  @media (width >= 40rem) {
    color: red;
  }
}
```

```css
/* chrome >= 100 を対象にした場合 */
@media (min-width: 40rem) {
  .a {
    color: red;
  }
}
```

> pugkit は PostCSS のプラグインを受け付けません。CSS の後処理は Lightning CSS に一本化されています。

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
  "sprite": "pugkit sprite"
}
```

### Image Optimization

ビルド時に `src/` 配下の画像を自動的に最適化します。

| `build.image.format` | 挙動                        |
| -------------------- | --------------------------- |
| `'webp'`             | PNG/JPEG/GIF を WebP に変換 |
| `'avif'`             | PNG/JPEG/GIF を AVIF に変換 |
| `'compress'`         | 元の形式を維持したまま圧縮  |

> `src/` に置いた JPEG / PNG / GIF は必ず処理されます。原寸のまま出したい画像は `public/` に置いてください。
>
> `compress` を指定した場合は形式を保ったまま圧縮します（GIF はそのままコピーされます）。
>
> `src/` に `.webp` / `.avif` を置いた場合はどのタスクの対象にもならず、出力されません。ビルド時に警告が出ます。これらは `public/` に置いてください。

#### 画像は 1 枚だけ置く

`src/` には最大解像度の 1 枚だけを置きます。等倍版はビルドが生成するので、`@2x` を用意する必要はありません。

```
src/assets/img/hero.jpg   (1600x1200)
  ↓  sourceDensity: 2
dist/assets/img/hero.webp      (1600x1200)   ← 無印は src と同じ寸法
dist/assets/img/hero@half.webp   ( 800x600)
```

無印を原寸のままにしているのは、CSS の `url()` 直書きや OGP 画像など `imageInfo()` を通らない参照が壊れないようにするためです。

| 設定               | 挙動                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `sourceDensity: 2` | 等倍版を生成し、`srcset` に `1x` / `2x` を並べる（既定）             |
| `sourceDensity: 1` | 原寸を 1 枚出すだけ。縮小しない。候補が 1 つなので `srcset` は出ない |

等倍のまま出したい画像（ロゴやアイコンなど）は `public/` に置いてください。`public/` の画像は変換も縮小もされません。

> GIF と SVG は密度の対象外です。幅記述子の対象にもなりません。

#### 幅違いの生成

`imageInfo()` に `widths` を渡した画像だけ、幅違いが生成されます。設定項目はありません。どの幅が要るかはレイアウトによって決まるので、その場所を書いている側で指定します。

```
src/assets/img/hero.jpg   (1600x1200)
  ↓  widths: [400, 800, 1200]
dist/assets/img/hero.webp        (1600x1200)
dist/assets/img/hero@half.webp   ( 800x600)
dist/assets/img/hero@400w.webp   ( 400x300)
dist/assets/img/hero@800w.webp   ( 800x600)
dist/assets/img/hero@1200w.webp  (1200x900)
```

原寸以上の幅は作られません。`hero.jpg` が 1600px なら `widths: [1200, 1600, 2000]` で作られるのは 1200 だけで、1600 は無印が兼ねます。

`widths` を渡した画像にも `@half` は作られます。同じ画像を別のページが密度記述子で参照したときに、その `srcset` が指す先が必要になるためです。

dev では幅違いを起動時に作らず、ブラウザから要求された時点で作ります。起動が遅くならない代わりに、dev と build のアセットが揃うのはページを開いた後になります。dev が 1 枚の画像に作る幅は 32 本までです。それを超えると 404 を返してログに出します。build に上限はありません。

> `@half` と `@<数字>w` はビルドが作る名前です。この形の画像を `src/` や `public/` に置くと、build が中止します。

#### 特定画像の個別オプション指定

`build.image.overrides` で特定の画像にのみ別の圧縮オプションを適用できます。キーは `src/` からの相対パス、値はグローバル設定に上書きマージされる [Sharp](https://sharp.pixelplumbing.com/api-output) オプションオブジェクトです。幅違いにも同じ値が掛かります。幅ごとに変えることはできません。

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

pugkit が既定値を上書きするのは、整形しない要素の指定と字下げまわりだけです。表示に関わる判定は js-beautify の既定に任せています。

`inline` を上書きすると、インライン要素が改行されてそこに空白が生まれます。`li` や `a` を `inline-block` で詰めて並べていると、ソースに書いていない隙間が入ります。

`content_unformatted` から `textarea` を外すと、textarea の中身、つまり表示される値そのものが整形されます。上書きする場合は残してください。

### SVG Optimization

`icons/`以外に配置した SVG ファイルはSVGOで自動最適化されて出力されます。

### SVG Sprite

`src/`配下の`icons/`ディレクトリに配置したSVGを1つのスプライトファイルにまとめます。

```
src/assets/icons/arrow.svg  →  <outDir>/assets/icons.svg#arrow
```

```html
<svg><use href="assets/icons.svg#arrow"></use></svg>
```

- SVG ファイル名がそのまま `<symbol id>` になります
- `fill` / `stroke` は自動的に `currentColor` に変換されます

### Public Directory

`public/` に置いたファイルは、ディレクトリ構成を保ったまま出力先へコピーされます（`subdir` を指定している場合はその配下）。変換も縮小もされないので、favicon・OGP画像のほか、等倍のまま出したい画像の置き場としても使います。

`src/` と `public/` で同じ出力先になるファイルがあった場合は、どちらが残るかが決まらないため `build` を中止します。どちらか一方を削除してください。`dev` は起動時に検査してログに出しますが、起動は続けます。

`@half` と `@<数字>w` で終わる画像も同じ扱いで中止します。これはビルドが縮小版と幅違いに使う名前で、幅違いの出力先は事前に列挙できないため、名前を予約することで衝突を防いでいます。`@2x` のようなデザインツールの書き出し名は対象外です。

出力先が重なるかは設定によります。既定の `build.image.format: 'webp'` では `src/logo.png` は `logo.webp` になるため `public/logo.png` とは衝突しません。`compress` では両方が `logo.png` を取り合います。

### Dev / Build の出力の違い

| 対象   | dev                                           | build                        |
| ------ | --------------------------------------------- | ---------------------------- |
| HTML   | リクエスト時ビルド + メモリ配信               | 全ページビルドして書き出し   |
| CSS    | expanded + ソースマップ                       | minify済み                   |
| JS     | ソースマップ・`console.*` 保持                | minify済み・`console.*` 削除 |
| 出力先 | `cacheDir`（既定 `node_modules/.pugkit/dev`） | `outDir`                     |

> `outDir` は build 専用です。dev は `outDir` に書き込みも読み出しもしないため、dev のソースマップ等が本番成果物に混ざりません。

> `outDir` は pugkit が占有します。build のたびに中身を削除してから書き出すので、手で置いたファイル（`.htaccess`・PHP・アップロード等）は残りません。出力に含めたいものは `public/` に置いてください。

### 出力先に指定できる場所

`outDir` と `cacheDir` はどちらも中身を丸ごと削除します。消してはいけない場所を指定する事故を防ぐため、起動時に検査して中止します。

`outDir` は、プロジェクトルート・`src`・`public`・`node_modules` を含む場所と、`src`・`public` の配下を指定できません。

`cacheDir` は、プロジェクトルート・`src`・`public`・`outDir` を含む場所と、`src`・`public`・`outDir` の配下を指定できません。

`cacheDir` にはさらに 2 つの守りがあります。指定先に pugkit が作った目印が無いのに中身が存在する場合は、削除せず起動を中止します。空のディレクトリか、存在しないパスを指定してください。

また、別の dev サーバーが同じ `cacheDir` を使用中の場合も中止します。ポートを変えれば 2 つ目を起動できてしまうため、ポートではなくディレクトリ側で判定しています。

### エラー表示

CLI が異常終了したときは、原因のメッセージだけを表示して終了コード `1` を返します。設定ミスや出力先の衝突など、ソースを直せば済むエラーがスタックトレースに埋もれないようにするためです。

pugkit 自身の不具合を調べたい場合は `PUGKIT_DEBUG=1` を付けるとスタックトレースが出ます。

```sh
PUGKIT_DEBUG=1 npx pugkit build
```

## Tech Stack

| ライブラリ                                        | 役割                                    |
| ------------------------------------------------- | --------------------------------------- |
| [Pug](https://pugjs.org/)                         | HTMLテンプレートエンジン                |
| [Sass](https://sass-lang.com/)                    | CSSプリプロセッサー                     |
| [esbuild](https://esbuild.github.io/)             | TypeScript/JavaScriptバンドラー         |
| [Lightning CSS](https://lightningcss.dev/)        | CSS後処理（プレフィックス・降格・圧縮） |
| [Sharp](https://sharp.pixelplumbing.com/)         | 画像最適化                              |
| [SVGO](https://svgo.dev/)                         | SVG最適化                               |
| [Chokidar](https://github.com/paulmillr/chokidar) | ファイル監視                            |
| [sirv](https://github.com/lukeed/sirv)            | 静的配信（開発サーバー、SSE と併用）    |
