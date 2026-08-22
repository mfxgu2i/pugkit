# プロパティの書き方

層に依らず、SCSSを書くときに常に守る。components でも projects でも utilities でも同じ。

## 寸法と余白は論理プロパティで書く

`width` ではなく `inline-size`、`margin-top` ではなく `margin-block-start` を使う。

```scss
.c-card {
  inline-size: 100%;
  padding-block: var(--spacing-block-padding);
  padding-inline: var(--container-padding);
  border-block-end: 1px solid var(--color-border);
}
```

左右の対を1プロパティで書けるので、`padding-left` と `padding-right` を並べるより短くなる。書字方向を変えたときにも値を書き直さずに済む。

物理プロパティと混ぜない。片方だけ論理で書くと、上書きするときにどちらが効くかを毎回確かめることになる。

## 動かすプロパティを名指しする

`transition: all` を使わない。何が動くかがコードから読めなくなり、意図していないプロパティまで遷移する。

```scss
.c-button {
  transition: translate var(--duration-normal);

  @include f.hover {
    translate: 0 -2px;
  }
}
```

時間はトークンから取る。値を直接書くと、速さがコンポーネントごとにばらつく。

移動と回転は `transform` にまとめず、`translate` と `rotate` の個別プロパティで書く。まとめると、移動だけを遷移させたいときに回転まで巻き込む。
