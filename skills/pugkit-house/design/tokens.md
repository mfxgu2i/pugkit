# 変数とデザイントークン

値の定義場所を2つに分ける。Sass変数は `foundation/_variables.scss`、CSSカスタムプロパティは `foundation/_tokens.scss` に集約する。

```
foundation/
├── _index.scss       variables・functions・mixins を @forward し、reset と tokens と base を出力する
├── _variables.scss   Sass変数
├── _tokens.scss      CSSカスタムプロパティ
├── _reset.scss
├── _base.scss        要素セレクタだけ。値は持たない
├── functions/
└── mixins/
```

## どちらで書くか

| 何を持つか | どちらで書くか | 置き場所 |
|---|---|---|
| メディアクエリの境界 | Sass変数 | `_variables.scss` |
| rem 換算の基準にするルートの文字サイズ | Sass変数 | `_variables.scss` |
| ループや条件分岐で使う値 | Sass変数 | `_variables.scss` |
| 色・書体・文字サイズ・コンテンツ幅・余白 | CSSカスタムプロパティ | `_tokens.scss` |
| コンポーネント内でだけ切り替える値 | `--_` 始まりのローカル変数 | そのコンポーネントのファイル |

メディアクエリの条件部分はCSSカスタムプロパティを参照できないため、Sass変数で持つしかない。rem の換算もコンパイル時に割り算を済ませるので、基準値はSass変数になる。それ以外はCSSカスタムプロパティにする。DevToolsで値の出どころを追えて、テーマの切り替えやメディアクエリでの上書きもできる。

そのコンポーネントの中だけで使うローカル変数は `_tokens.scss` に入れない。`--_` で始めておくと、トークンと見分けが付き、外から触るものではないと分かる。

## 命名

用途で名前を付ける。カテゴリを先頭に置き、修飾子を後ろに足す。

| カテゴリ | 例 |
|---|---|
| 色 | `--color-text` `--color-text-muted` `--color-primary` |
| 書体 | `--font-family-base` `--font-size-md` `--line-height-base` |
| コンテンツ幅 | `--contents-default` `--contents-narrow` |
| 余白 | `--container-padding` `--container-padding-sp` `--section-gap` |

SP だけ値が違うものは `-sp` を足して2つ持つ。メディアクエリの中でトークンを再宣言すると、DevTools でどちらが効いているか追いにくい。

## _tokens.scss は :root ひとつ

CSSカスタムプロパティの宣言は `_tokens.scss` の `:root` にまとめる。他のファイルで `:root` を書かない。書くと、値の出どころを探すのにファイル全体を検索することになる。

## 単位はトークンで決める

文字サイズは rem、余白と寸法は px で持つ。単位まで含めてトークンに入れるので、呼び出し側は `var()` をそのまま書く。

```scss
@use 'functions/rem' as fn;

:root {
  // 文字サイズ。カンプの px を rem に換算して持つ
  --font-size-2xl: #{fn.rem(24)};
  --font-size-md: #{fn.rem(16)};

  // 余白と寸法。px のまま持つ
  --contents-default: 1200px;
  --container-padding: 40px;
  --container-padding-sp: 20px;

  // 色と行間は換算しない
  --color-primary: #005bac;
  --line-height-base: 1.7;
}
```

換算の関数は `foundation/functions/_rem.scss` に置く。

```scss
@use 'sass:math';
@use '../variables' as v;

@function rem($value) {
  @return math.div($value, v.$root-font-size) * 1rem;
}
```

CSSカスタムプロパティの値の中では Sass の関数呼び出しが評価されないため、`#{}` で展開する。展開した結果は `1.5rem` のような静的な値になるので、実行時に `calc()` は残らない。

文字サイズだけ rem にするのは、ブラウザの文字サイズ設定に文字だけ追従させるため。余白まで rem にすると、文字を大きくしたときに組み全体が広がる。px で持てば、文字が伸びてもレイアウトは動かない。

## トークンに無い値

一回限りの文字サイズは `rem()` に数値を渡す。カンプの px をそのまま書けて、出力は `1.125rem` に畳まれる。

```scss
@use '../foundation' as f;

.p-top-lead__note {
  font-size: f.rem(18);
}
```

同じ値が2箇所以上に出てきたらトークンにする。

`f.rem()` に `var()` を渡さない。`f.rem(var(--font-size-2xl))` は `Undefined operation` でコンパイルが止まる。トークンにある値は換算済みなので、`var()` をそのまま書く。

## 参照のしかた

他の層からは `foundation` をまとめて読む。`_variables.scss` や `_tokens.scss` を個別に `@use` しない。

```scss
@use '../foundation' as f;

.c-button {
  font-size: var(--font-size-md);
  padding-inline: var(--container-padding);

  @include f.media-breakpoint-down(md) {
    font-size: var(--font-size-sm);
  }
}
```

トークンを参照するだけなら `@use` は要らない。mixin と関数を使うときに読む。

`foundation/` の中から参照するときだけ `@use 'variables' as v` のように直接指す。`foundation/_index.scss` を経由すると循環参照になる。

## やってはいけないこと

コンポーネントに生の値を書かない。`color: #1a1a1a` や `max-width: 1200px` が出てきたら、サイト全体で使い回すのかを判断する。使い回すならトークン、1か所だけならローカル変数にする。

トークンに見た目の名前を付けない。`--color-blue` ではなく `--color-primary` にする。ブランドカラーが変わったとき、名前と中身が食い違う。
