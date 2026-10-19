# +Image

用途は `src/assets/img/` 配下の画像を `picture` として出力すること。密度記述子と幅記述子、アートディレクションは `imageInfo()` が解決し、遅延読み込みの属性は mixin が付ける。

## 依存

| 依存 | 出どころ |
|---|---|
| `imageInfo` `Builder.dir` | pugkit が提供するグローバル |
| `BREAK_POINTS` | `_templates/_constants.pug` |

`public/` 配下の画像には使えない。変換も縮小もされないため、別 mixin を用意する。

## 呼び出しの形

```pug
+Image('logo.png', { alt: 'ロゴ' })

+Image('hero.jpg', {
  alt: '',
  lazy: false,
  widths: [640, 960, 1280],
  sizes: '(width < 768px) 100vw, 1280px'
})
```

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `path` | string | 必須 | `assets/img/` からの相対パス |
| `args.alt` | string | `''` | 代替テキスト |
| `args.media` | string | `'md'` | アートディレクションを切り替えるブレークポイントのキー |
| `args.lazy` | boolean | `true` | `false` にすると即時に読み込み、優先度を上げる |
| `args.class` | string | なし | `picture` 要素に付けるクラス |
| `args.widths` | number[] | なし | 幅記述子で出すときの幅の一覧 |
| `args.sizes` | string | なし | 表示幅の指定。`widths` とセットで使う |

## 組み方

`imageInfo()` に `` `${Builder.dir}assets/img/${path}` `` と、`{ widths, sizes }` を渡す。戻り値の属性をそのまま `picture` の中の `source` と `img` に渡す。

| 出力 | 中身 |
|---|---|
| `picture` | `class` に `args.class` |
| `source` | 戻り値に `variant` があるときだけ出す。`media` は `BREAK_POINTS[args.media]`、無ければ `BREAK_POINTS.md`。`srcset` `sizes` `width` `height` は `variant` から取る |
| `img` | `src` `srcset` `sizes` `width` `height` を戻り値から取る。`alt` は空文字を既定にする |

`lazy` の扱いは2つの属性に分かれる。

| `args.lazy` | `loading` | `fetchpriority` |
|---|---|---|
| `false` 以外 | `lazy` | 付けない |
| `false` | 付けない | `high` |

`sizes` は幅記述子のときだけ返るので、条件を付けずにそのまま渡してよい。

## SCSS

この mixin は寸法を持たない。サイズ指定は使う側のクラスで行う。

```scss
.p-service__image {
  img {
    inline-size: 100%;
    block-size: auto;
  }
}
```

## やってはいけないこと

ファーストビューの画像に `lazy` を残さない。LCP が遅れる。`{lazy: false}` を渡す。

`width` と `height` を手で書かない。`imageInfo()` が実ファイルから解決するので、手書きすると実寸とずれてレイアウトシフトが起きる。

`widths` を渡すときに `sizes` を省かない。ブラウザは 100vw として候補を選び、重いファイルを取りに行く。`sizes` のメディア条件は `media` のブレークポイントと境界を揃える。

SP 画像を出したいときにメディアクエリで切り替えない。同じディレクトリに接尾辞付きのファイルを置けば `info.variant` として自動で拾われる。

`imageInfo()` の戻り値と、密度記述子と幅記述子の使い分けは pugkit skill の `pugkit/references/images.md` にある。
