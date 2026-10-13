# ホバー

`:hover` を直接書かず mixin を通す。タッチ端末でタップ後にホバーが残るのを避けるため。mixin は `foundation/mixins/_hover.scss` に置く。

## mixin

| mixin | 当たる条件 |
|---|---|
| `hover` | ホバーできる環境で、自身がリンク・有効な要素・`summary` のとき |
| `child-hover` | 子孫のリンクやボタンがホバー、またはフォーカスされたとき |

```scss
.c-button {
  @include f.hover {
    opacity: 0.7;
  }
}
```

## hover の組み方

`@media (any-hover: hover)` で包み、その中で `&:where(:any-link, :enabled, summary):hover` に `@content` を当てる。

`any-hover` で包むのは、タッチ端末でタップ後にホバーが残るのを避けるため。対象を `:any-link` と `:enabled` と `summary` に絞るのは、無効化されたボタンやリンクでない要素に当てないため。`:where()` で包むので詳細度は上がらない。

## child-hover の組み方

カードの中にリンクが1つあり、カード全体を反応させたいときに使う。

```scss
.c-card {
  @include f.child-hover {
    background-color: var(--color-bg-muted);
  }
}
```

2つの条件に同じ `@content` を当てる。

| 条件 | セレクタの形 |
|---|---|
| `any-hover: hover` の環境で、子孫のリンクやボタンがホバーされた | `&:has(:where(a, button):where(:any-link, :enabled):hover)` |
| 子孫のリンクやボタンがキーボードでフォーカスされた | `&:has(:where(a, button):focus-visible)` |

フォーカスの条件はメディアクエリの外に置く。キーボード操作でも同じ見た目にするためで、外部キーボードをつないだタブレットのように `any-hover: hover` に当たらない環境でも効かせる必要がある。`hover` のほうにフォーカスは入れない。

## やってはいけないこと

`&:hover` を直接書かない。タッチ端末でホバーが残る。
