# 画像 mixin

`imageInfo()` を包み、密度記述子と幅記述子・アートディレクション・遅延読み込みをまとめて扱う mixin。

**プロジェクトに既存の画像 mixin があればそれを使う。** これは無い場合に作るための実装例で、create-pugkit テンプレートの `src/_templates/mixins/_Image.pug` と同じもの。配置場所と命名はプロジェクトの流儀に合わせる。

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
    sm: '(max-width: 575px)',
    md: '(max-width: 767.98px)',
    lg: '(max-width: 889.98px)'
  }
```

## 使い方

```pug
+Image('logo.png', { alt: 'ロゴ' })

+Image('hero.jpg', {
  alt: '',
  lazy: false,
  widths: [640, 960, 1280],
  sizes: '(max-width: 767px) 100vw, 1280px'
})
```

| 引数           | 内容                                                     |
| -------------- | -------------------------------------------------------- |
| `path`         | `assets/img/` 配下の画像パス                             |
| `args.alt`     | 代替テキスト（既定 `''`）                                |
| `args.media`   | アートディレクションのブレークポイントキー（既定 `'md'`） |
| `args.lazy`    | 遅延読み込み（既定 `true`）。`false` で `fetchpriority='high'` |
| `args.class`   | `picture` に付けるクラス                                 |
| `args.widths`  | 幅記述子で出すときの幅の一覧                             |
| `args.sizes`   | 表示幅の指定。`widths` とセットで使う                    |

`widths` を渡したときは表示幅を CSS で決める。`imageInfo()` の仕様は [../references/images.md](../references/images.md) を参照。
