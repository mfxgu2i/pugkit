# 画像の出し方（imageInfo）

`imageInfo(path, options)` は画像のパスと寸法を返す。渡すパスは `${Builder.dir}` の相対パスか、`${Builder.subdir}` を前置きしたルート相対パスで組み立てる。返る `src` は渡したパスの形式を保つため、ページの階層が変わっても正しいパスになる。画像は `src/` から探し、見つからなければ `public/` も探す。

## パスの書き方

| 書き方         | 例                                                     | 返る `src`                          |
| -------------- | ------------------------------------------------------ | ----------------------------------- |
| 相対パス       | ``imageInfo(`${Builder.dir}assets/img/hero.jpg`)``     | `../assets/img/hero@half.webp`      |
| ルート相対パス | ``imageInfo(`${Builder.subdir}/assets/img/hero.jpg`)`` | `/subdir/assets/img/hero@half.webp` |

`/` 始まりはサイトルート起点の URL として解決する。`subdir` を設定している場合、出力も URL も `subdir` 配下に入るため、`${Builder.subdir}` の前置きが要る。前置きの無い `/assets/...` は本番に存在しない URL なので解決せず、警告が出る。

```
⚠ pug Image not found "/assets/img/hero.jpg" in index.pug。ルート相対パスはサイトルート起点で解決します。`${Builder.subdir}` を前置きしてください
```

`subdir` が空のプロジェクトでは `${Builder.subdir}` が空文字になるため、`/assets/...` がそのまま書ける。設定を後から足しても壊れないよう、ルート相対で書くときは常に `${Builder.subdir}` を前置きする。

`src/` には最大解像度の画像を1枚だけ置く。縮小版はビルドが生成するため、同じ画像を解像度ごとに用意しない。

## 戻り値

| プロパティ | 内容                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `src`      | 表示サイズのパス。幅記述子モードでは原寸のパス                                   |
| `width`    | 表示サイズの幅。幅記述子モードでは原寸の幅                                       |
| `height`   | 同上                                                                             |
| `srcset`   | 候補が2つ以上のときだけ返る。1つのときは `undefined`                             |
| `sizes`    | 幅記述子の `srcset` を出したときだけ返る                                         |
| `format`   | 画像フォーマット（`'jpg'` / `'png'` / `'svg'` など）                             |
| `isSvg`    | SVG かどうか                                                                     |
| `variant`  | `build.image.artDirectionSuffix`（既定 `_sp`）で検出したアートディレクション画像 |

`srcset` / `sizes` は値が無ければ `undefined` になり属性ごと省略されるため、そのまま渡してよい。

## オプション

| オプション | 型         | 内容                                                                         |
| ---------- | ---------- | ---------------------------------------------------------------------------- |
| `widths`   | `number[]` | 生成する幅の一覧。渡すと `srcset` が幅記述子になる。原寸以上の幅は作られない |
| `sizes`    | `string`   | 表示幅の指定。そのまま返るので `sizes` 属性に渡す。`widths` と組で使う       |

## 2つのモード

| モード     | 使うとき                                                 | 呼び出し方                           |
| ---------- | -------------------------------------------------------- | ------------------------------------ |
| 密度記述子 | 表示幅が固定の画像（既定）                               | `imageInfo(path)`                    |
| 幅記述子   | 画面幅に応じて表示幅が変わる画像（メインビジュアルなど） | `imageInfo(path, { widths, sizes })` |

### 密度記述子（既定）

`build.image.sourceDensity: 2`（既定）では原寸を 2x、自動生成される `@half` を 1x として `srcset` を出す。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`)
img(src=info.src srcset=info.srcset width=info.width height=info.height alt='ヒーロー画像')
```

1600×1200 の `hero.jpg` を置いた場合の出力:

```html
<img
  src="assets/img/hero@half.webp"
  srcset="assets/img/hero@half.webp 1x, assets/img/hero.webp 2x"
  width="800"
  height="600"
  alt="ヒーロー画像"
/>
```

`src` と `width` / `height` は表示サイズ（`@half`）になる。`sourceDensity: 1` の場合は原寸1枚だけになり `srcset` は返らない。

### 幅記述子

`widths` を渡すと幅記述子になる。指定した幅の画像だけが生成され、原寸以上の幅は作られない。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`, { widths: [640, 960, 1280], sizes: '(max-width: 767px) 100vw, 1280px' })
img(src=info.src srcset=info.srcset sizes=info.sizes width=info.width height=info.height alt='ヒーロー画像')
```

守ること:

- `sizes` を必ず渡す。省くとブラウザは画面いっぱいに表示されるものとみなし、重い候補を選ぶ。
- `sizes` だけを渡しても効かない。`widths` とセットで使う。
- **表示幅を CSS で指定する。** 幅記述子モードでは `width` / `height` 属性が原寸になるため、CSS で幅を決めないと原寸のまま表示される。
- アートディレクションと併用する場合、`sizes` のメディア条件は `source` の `media` と境界を揃える。

CSS で幅を決めるときは `height: auto` を添え、`width` / `height` 属性は消さない。属性があることでブラウザが表示前に領域を確保でき、レイアウトシフト（CLS）を防げる。

## srcset が返らない場合

`srcset` は候補が2つ以上あるときだけ返る。次の場合は `undefined` になり、属性ごと省略される。

- SVG / GIF
- `public/` に置いた画像
- `sourceDensity: 1`
- 指定した `widths` がすべて原寸以上

`variant.srcset` は `source` の必須属性のため、候補が1つでも返る（[art-direction.md](art-direction.md)）。

## mixin にまとめる

同じ呼び出しを繰り返す場合は mixin に包む。どう包むかはプロジェクトの流儀に合わせる。

## 画像が見つからないとき

パスが解決できない場合は警告を出し、`src` に渡したパスをそのまま返す。`width` / `height` / `srcset` は `undefined` になる。
