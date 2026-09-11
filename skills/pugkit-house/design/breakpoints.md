# ブレークポイント

SCSS 側のメディアクエリの型。

Pug 側にも `_templates/_constants.pug` の `BREAK_POINTS` があり、そちらはメディアクエリの文字列を持つ。画像のアートディレクションと、JS へ渡す `matchMedia` の条件がそこから出る。両者の境界は必ず揃える。ずれると、`source` が切り替わる幅、CSS のレイアウトが切り替わる幅、JS が開閉をやめる幅が食い違う。

## 定義

`foundation/_variables.scss` にマップで持つ。

```scss
$grid-breakpoints: (
  xs: 0,
  sm: 575.98px,
  md: 767.98px,
  lg: 889.98px,
  xl: 1229.98px,
  xxl: 1399.98px
) !default;
```

型として決まっているのはキー名と、値が SP 側の上限であることの2つ。数値そのものは要件に合わせて差し替える。

値がすべて `.98` の端数なのは、`max-width` と `min-width` の境界を重ねないため。`down` はマップの値をそのまま `max-width` に使い、`up` は `+0.02` して `min-width` に使う。こうすると 767.98px と 768px で隙間なく、かつ二重に当たらずに切り替わる。`max-width: 768px` と `min-width: 768px` を並べると 768px でどちらも当たる。

## mixin

| mixin | 展開されるもの |
|---|---|
| `media-breakpoint-up($name)` | `@media (min-width: 値 + 0.02)` |
| `media-breakpoint-down($name)` | `@media (max-width: 値)` |
| `media-breakpoint-between($lower, $upper)` | `min-width` と `max-width` の両方で挟む |
| `media-breakpoint-only($name)` | そのキーの範囲だけで挟む |
| `media-breakpoint-range($max)` | `@media (max-width: $max)`。マップを通さず任意の値で切る |
| `media-ratio($ratio)` | 高解像度ディスプレイ向け。既定は2倍 |

`foundation/mixins/_breakpoints.scss` に置く。

```scss
@use 'sass:map';
@use 'sass:list';
@use '../variables' as v;

@function breakpoint-value($name) {
  @if not map.has-key(v.$grid-breakpoints, $name) {
    @error '#{$name} は $grid-breakpoints に定義されていません';
  }

  @return map.get(v.$grid-breakpoints, $name);
}

@mixin media-breakpoint-up($name) {
  $value: breakpoint-value($name);

  @if $value == 0 {
    @content;
  } @else {
    @media (min-width: $value + 0.02) {
      @content;
    }
  }
}

@mixin media-breakpoint-down($name) {
  @media (max-width: breakpoint-value($name)) {
    @content;
  }
}

@mixin media-breakpoint-between($lower, $upper) {
  @media (min-width: breakpoint-value($lower) + 0.02) and (max-width: breakpoint-value($upper)) {
    @content;
  }
}

@mixin media-breakpoint-only($name) {
  $keys: map.keys(v.$grid-breakpoints);
  $index: list.index($keys, $name);

  @if $index == 1 {
    @include media-breakpoint-down($name) {
      @content;
    }
  } @else {
    @include media-breakpoint-between(list.nth($keys, $index - 1), $name) {
      @content;
    }
  }
}

@mixin media-breakpoint-range($max) {
  @media (max-width: $max) {
    @content;
  }
}

@mixin media-ratio($ratio: 2) {
  @media (min-resolution: #{$ratio}dppx) {
    @content;
  }
}
```

```scss
@use '../foundation' as f;

.c-headline {
  font-size: var(--font-size-3xl);

  @include f.media-breakpoint-down(md) {
    font-size: var(--font-size-2xl);
  }
}
```

## やってはいけないこと

`@media` を直接書かない。マップを通さないと境界がファイルごとにずれ、`767px` と `767.98px` と `768px` が混在する。

`min-width` と `max-width` を同じ数値で書かない。境界の1pxで両方当たるか、どちらも当たらない隙間ができる。
