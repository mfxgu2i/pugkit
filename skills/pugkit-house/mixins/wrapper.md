# +Wrapper

用途はセクションの外枠を作ること。背景の敷き方と内側の最大幅を1か所に集約する。セクションには必ずこれを使う。

## 依存

| 依存 | 出どころ |
|---|---|
| `.u-container` | utilities |

pugkit の機能には依存しない。

## mixin

```pug
mixin Wrapper(props = {})
  -
    const tag = props.as || 'section'
    const container = props.container !== undefined ? (props.container || null) : 'u-container'
    const classes = [
      props.overflow && 'c-wrapper--overflow',
      props.position && `c-wrapper--${props.position}`
    ].filter(Boolean)
    const bgIsHtml = props.bg && props.bg.trimStart().startsWith('<')

  #{tag}.c-wrapper(class=classes id=props.id)
    if props.bg
      .c-wrapper__bg(class=bgIsHtml ? null : props.bg)!= bgIsHtml ? props.bg : null
    .c-wrapper__container(class=container)
      block
```

## 引数

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `as` | string | `'section'` | ラッパーのタグ名 |
| `container` | string | `'u-container'` | 内側コンテナのクラス。`null` を渡すとクラスなし |
| `bg` | string | なし | `<` で始まればHTMLとして出力、それ以外はクラス名として `__bg` に付く |
| `overflow` | boolean | `false` | `overflow: hidden` を効かせる |
| `position` | string | なし | `sticky` または `fixed` |
| `id` | string | なし | ラッパーのid |

## SCSS

```scss
.c-wrapper {
  --_overflow: initial;
  --_position: relative;

  position: var(--_position);
  z-index: 1;
  overflow: var(--_overflow);

  &__bg {
    position: absolute;
    inset: 0;
    z-index: -1;
    inline-size: 100%;
    block-size: 100%;
    pointer-events: none;

    picture,
    img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
  }

  &--overflow {
    --_overflow: hidden;
  }

  &--sticky {
    --_position: sticky;
    inset-block-start: 0;
    z-index: 1;
  }

  &--fixed {
    --_position: fixed;
    inset-block-start: 0;
    z-index: 1;
    inline-size: 100%;
  }
}
```

内側の最大幅はユーティリティ側が持つ。

```scss
@use '../foundation' as f;

.u-container {
  box-sizing: content-box;
  max-inline-size: var(--contents-default);
  padding-inline: var(--container-padding);
  margin-inline: auto;

  @include f.media-breakpoint-down(md) {
    padding-inline: var(--container-padding-sp);
  }
}
```

`md` は SP と PC の主境界のキー。`$grid-breakpoints` の値に合わせる。

## セクションの積み上げ

ページは `+Wrapper()` を縦に並べて組み立てる。`block contents` の直下に兄弟として置き、1つの `+Wrapper()` に1つの `.p-*` ブロックを入れる。

```pug
block contents
  +Wrapper()
    .p-top-hero

  +Wrapper()
    .p-top-news

  +Wrapper({bg: 'p-top-about-bg'})
    .p-top-about
```

`main` にレイアウトクラスを付けない。幅も背景も上下余白も `.c-wrapper` と `.u-container` と `.p-*` が持つので、`main` 側に持たせるものがない。

`+Wrapper()` を入れ子にしない。入れ子にすると `.u-container` が二重にかかり、`padding-inline` が左右に二度足される。背景を重ねたいときは `bg` に渡したクラスの `::before` と `::after` で描く。

セクションの区切りが必要なだけなら `props` は空でよい。既定で `section` タグと `.u-container` が付く。

## 使用例

```pug
+Wrapper({bg: 'p-top-hero-bg'})
  .p-top-hero
    h2.p-top-hero__title サービス

+Wrapper({bg: '<picture><img src="/assets/img/bg.jpg" alt=""></picture>'})
  .p-about
    p 本文

+Wrapper({as: 'div', container: null, position: 'sticky'})
  .l-global-nav
```

## やってはいけないこと

セクションの上下余白を bg クラスに入れない。余白はコンテンツクラスの `.p-*` 側に持たせる。bg クラスに入れると、背景を変えたいだけのときに余白まで動く。

装飾のデコ円やSVG背景を子要素として出力しない。`__bg` に付けたクラスの `::before` と `::after` で描く。子要素にするとマークアップにデザイン都合の空要素が増える。

`u-container` を使ったうえで `max-width` を上書きしない。幅を変えたいときは `container` に別のユーティリティクラスを渡す。
