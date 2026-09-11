# 状態と条件分岐

見た目を切り替える条件をどこに持つか。層に依らず、layouts でも components でも projects でも同じ。

## 状態はクラスではなく属性で持つ

開閉やカレントのような状態は、`is-open` のようなクラスではなく `aria-expanded` や `aria-current` で持つ。

```scss
.l-header:has(.l-header__toggle[aria-expanded='true']) .l-header__nav {
  visibility: visible;
}
```

支援技術に伝わる情報とスタイルの根拠が1つになる。クラスで持つと、見た目だけ変わって読み上げが変わらない実装になりやすい。

読み上げに関係しない状態は `data-*` にする。スライドの表示枚数や配色の反転のように、支援技術に伝える意味を持たないものが該当する。`aria-*` に無理に当てはめると、実際には存在しない意味を伝えることになる。

```scss
.c-carousel[data-slides-per-view='1'] {
  --_gap: 0;
}
```

JS は属性だけを書き換える。クラスもスタイルも触らない。CSS は属性を `:has()` 越しに読んで見た目を決める。状態の出どころが1つになるので、片方だけ直す事故が起きない。

`details` の `open` や `dialog` の `open` のように、ブラウザが状態を持つものもある。部品ごとにどの属性を使うかは `ui/` の各ファイルが持つ。

## 中身の有無で分岐する

「画像がないとき」のような分岐に修飾子クラスを足さない。`:has()` で中身を見る。

```scss
.c-news-article {
  grid-template: 'date category icon' auto / auto 1fr auto;

  &:not(:has(.c-news-article__image)) {
    grid-template: 'date category' auto / auto 1fr;
  }
}
```

修飾子にすると、中身を入れる側と修飾子を付ける側の2箇所を合わせることになる。片方だけ直すとレイアウトが崩れる。`:has()` なら中身がそのまま条件になるので、ずれようがない。
