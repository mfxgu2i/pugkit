# ホバー

`:hover` を直接書かず mixin を通す。タッチ端末でタップ後にホバーが残るのを避けるため。mixin は `foundation/mixins/_hover.scss` に置く。

## mixin

| mixin | 当たる条件 |
|---|---|
| `hover` | ホバーできる環境で、自身がリンク・有効な要素・`summary` のとき |
| `child-hover` | 子孫のリンクやボタンがホバー、またはフォーカスされたとき |

`foundation/mixins/_hover.scss` に置く。

```scss
// 自身がリンク・有効な要素・summary のときだけ当たる
@mixin hover {
  @media (any-hover: hover) {
    &:where(:any-link, :enabled, summary):hover {
      @content;
    }
  }
}

// 子孫のリンクやボタンがホバー、またはフォーカスされたとき
@mixin child-hover {
  @media (any-hover: hover) {
    &:has(:where(a, button):where(:any-link, :enabled):hover) {
      @content;
    }
  }

  &:has(:where(a, button):focus-visible) {
    @content;
  }
}
```

```scss
@use '../foundation' as f;

.c-button {
  @include f.hover {
    opacity: 0.7;
  }
}
```

対象は `&:where(:any-link, :enabled, summary):hover` に絞ってある。無効化されたボタンやリンクでない要素には当たらない。`:where()` なので詳細度は上がらない。

## child-hover

カードの中にリンクが1つあり、カード全体を反応させたいときに使う。

```scss
.c-card {
  @include f.child-hover {
    background-color: var(--color-gray-4);
  }
}
```

`:focus-visible` にも同じ内容が当たるので、キーボード操作でも同じ見た目になる。`hover` のほうにフォーカスは入っていない。

## やってはいけないこと

`&:hover` を直接書かない。タッチ端末でホバーが残る。
