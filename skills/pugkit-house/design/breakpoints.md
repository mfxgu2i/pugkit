# ブレークポイント

SCSS 側のメディアクエリの型。

Pug 側にも `_templates/_constants.pug` の `BREAK_POINTS` があり、そちらはメディアクエリの文字列を持つ。画像のアートディレクションと、JS へ渡す `matchMedia` の条件がそこから出る。両者の境界は必ず揃える。ずれると、`source` が切り替わる幅、CSS のレイアウトが切り替わる幅、JS が開閉をやめる幅が食い違う。

## 定義

`foundation/_variables.scss` に `$grid-breakpoints` のマップで持ち、`!default` を付ける。

| キー | 値の例 |
|---|---|
| `xs` | `0` |
| `sm` | `576px` |
| `md` | `768px` |
| `lg` | `992px` |
| `xl` | `1200px` |
| `xxl` | `1400px` |

型として決まっているのはキー名と、値がそのキーから上の幅の始まりであることの2つ。数値そのものは要件に合わせて差し替える。`md` が SP と PC の主境界になる。

メディアクエリは範囲構文で書く。`down` は `(width < 値)`、`up` は `(width >= 値)` になり、同じ値を境に未満と以上で分かれる。ビューポートの幅は、拡大率や高 DPI の端末で 767.5px のような小数になる。`max-width: 767px` と `min-width: 768px` の組では、その幅がどちらにも当たらずにスタイルが抜ける。範囲構文なら、小数の幅でも必ずどちらか一方に当たる。

範囲構文は CSS ではそのまま書いてよい。古いブラウザに向けた出力が要るときも、pugkit が Lightning CSS を通して `(width < 768px)` を `not (min-width: 768px)` に書き換えて出す。値はずらさないので隙間はできない。

`BREAK_POINTS` の文字列は書き換えられず、`source` の `media` と `sizes`、`matchMedia()` にそのまま渡る。範囲構文は Baseline の Widely available なので、こちらも範囲構文で書く。

## mixin

`foundation/mixins/_breakpoints.scss` に置く。

| mixin | 展開されるもの |
|---|---|
| `media-breakpoint-up($name)` | `@media (width >= 値)`。値が `0` のキーはメディアクエリで包まずに中身をそのまま出す |
| `media-breakpoint-down($name)` | `@media (width < 値)` |
| `media-breakpoint-between($lower, $upper)` | `@media ($lower の値 <= width < $upper の値)`。`$lower` の値が `0` なら `$upper` の `down` だけを出す |
| `media-breakpoint-only($name)` | 1つ手前のキーとの `between`。先頭のキーを渡されたら `@error` で止める |
| `media-breakpoint-range($max)` | `@media (width < $max)`。マップを通さず任意の値で切る |
| `media-ratio($ratio)` | `@media (min-resolution: #{$ratio}dppx)`。既定は2倍 |

`between` で値が `0` のキーを `down` に落とすのは、`0 <= width` が常に真で、書いても意味がないため。

キーから値を引く処理は1つの関数にまとめる。マップに無いキーを渡されたら `@error` で止める。エラーを出さずに通すと、打ち間違えたキーのメディアクエリが空になり、どの幅でも当たらない宣言が残る。

```scss
.c-headline {
  font-size: var(--font-size-3xl);

  @include f.media-breakpoint-down(md) {
    font-size: var(--font-size-2xl);
  }
}
```

## やってはいけないこと

幅のメディアクエリを `@media` で直接書かない。マップを通さないと境界がファイルごとにずれ、`767px` と `768px` が混在する。`prefers-reduced-motion` や `any-hover` のように幅以外を見る条件は対象外で、`@media` で書く。

`min-width` と `max-width` で書かない。同じ数値なら境界で両方当たり、1px ずらすと小数の幅で隙間ができる。
