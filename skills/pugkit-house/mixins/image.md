# +Image

用途は `src/assets/img/` 配下の画像を `picture` として出力すること。密度記述子と幅記述子、アートディレクション、遅延読み込みを `imageInfo()` が解決する。

## 依存

| 依存 | 出どころ |
|---|---|
| `imageInfo` `Builder.dir` | pugkit が提供するグローバル |
| `BREAK_POINTS` | `_templates/_constants.pug` |

`public/` 配下の画像には使えない。変換も縮小もされないため、別 mixin を用意する。

## mixin

```pug
mixin Image(path, args = {})
  -
    const info          = imageInfo(`${Builder.dir}assets/img/${path}`, { widths: args.widths, sizes: args.sizes })
    const alt           = args.alt || ''
    const media         = BREAK_POINTS[args.media] || BREAK_POINTS.md
    const loading       = args.lazy !== false ? 'lazy' : undefined
    const fetchpriority = args.lazy === false ? 'high' : undefined

  picture(class=args.class)

    //- アートディレクション画像が存在する場合のみ出力
    //- sizes は幅記述子のときだけ返るので、そのまま渡してよい
    if info.variant
      source(
        media=media
        srcset=info.variant.srcset
        sizes=info.variant.sizes
        width=info.variant.width
        height=info.variant.height
      )
    img(
      src=info.src
      srcset=info.srcset
      sizes=info.sizes
      alt=alt
      width=info.width
      height=info.height
      loading=loading
      fetchpriority=fetchpriority
    )
```

`BREAK_POINTS` は定数ファイルに定義する。

```pug
-
  const BREAK_POINTS = {
    sm: '(max-width: 575.98px)',
    md: '(max-width: 767.98px)',
    lg: '(max-width: 889.98px)'
  }
```

## 引数

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `path` | string | 必須 | `assets/img/` からの相対パス |
| `args.alt` | string | `''` | 代替テキスト |
| `args.media` | string | `'md'` | アートディレクションを切り替えるブレークポイントのキー |
| `args.lazy` | boolean | `true` | `false` にすると `fetchpriority='high'` が付く |
| `args.class` | string | なし | `picture` 要素に付けるクラス |
| `args.widths` | number[] | なし | 幅記述子で出すときの幅の一覧 |
| `args.sizes` | string | なし | 表示幅の指定。`widths` とセットで使う |

## 使用例

```pug
+Image('logo.png', { alt: 'ロゴ' })

+Image('hero.jpg', {
  alt: '',
  lazy: false,
  widths: [640, 960, 1280],
  sizes: '(max-width: 767px) 100vw, 1280px'
})
```

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
