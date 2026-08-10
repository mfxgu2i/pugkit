# Sass / TypeScript

## パスの書き方

`@use` / `@forward` / `import` は `/` 始まりで `src/` を起点に解決される。Pug の `include` と同じ書き方で、階層に依存しない。相対指定もそのまま使える。

```scss
@use '/sass/tokens';        // src/sass/_tokens.scss
@use '../../sass/tokens';   // 同じファイルを相対で指定
```

```js
import { tag } from '/_lib/util'        // src/_lib/util.js
import { tag } from '../../_lib/util.js'
```

Sass はパーシャルの `_` と拡張子が補完される。ディレクトリを指定すると `_index.scss` を読む。JS は拡張子を省ける。

## エントリとパーシャル

`_` の付かない `.scss` / `.ts` / `.js` はすべてビルドの起点になる。他から読み込まれるだけの部品には `_` を付けるか、`_` 始まりのディレクトリに置く。付けないと、その部品自体も単体で出力される。

## Sass の後処理

コンパイル後は Lightning CSS を通し、ベンダープレフィックスの付与・モダン構文の降格・圧縮が自動で行われる。ベンダープレフィックスは手書きしない。

対象ブラウザは browserslist から読む。プロジェクトルートの `.browserslistrc` か、`package.json` の `browserslist` で指定する。指定が無ければ browserslist の既定が使われる。

## CSS から画像を参照する

`build.image.format` が `'webp'` / `'avif'` のとき、`src/` の画像は拡張子ごと変換される。Sass に `url('../img/bg.jpg')` と書くと出力に存在しないファイルを指し、`pugkit check references` で違反になる。

| 方法                             | 注意                                                     |
| -------------------------------- | -------------------------------------------------------- |
| 変換後の拡張子で書く             | `build.image.format` を変えると全部書き直しになる        |
| 背景画像を `public/` に置く      | 変換されないので元の拡張子のまま参照できる               |

サフィックスの無い出力（`bg.webp`）は必ず原寸。`@half` / `@<数字>w` は CSS から参照しない。

## TypeScript

esbuild でバンドルする。TypeScript はトランスパイルのみで型チェックは行わないため、`tsconfig.json` は不要。

型チェックが必要な場合のみ `typescript` を追加し、`tsc --noEmit` をビルドスクリプトに組み合わせる。

```json
"scripts": {
  "build": "tsc --noEmit && pugkit build"
}
```
