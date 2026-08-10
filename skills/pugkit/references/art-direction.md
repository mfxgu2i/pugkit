# アートディレクション（picture / source）

`src/` 配下の画像の隣に `build.image.artDirectionSuffix`（既定 `_sp`）に一致する画像（`hero.jpg` + `hero_sp.jpg`）があると、`imageInfo()` が自動検出して `info.variant` に入れる。

`imageInfo()` に渡すパスは Builder オブジェクトから組み立てる。返り値の `src`（`variant.src` も）は渡したパスの形式を保つ。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`)
picture
  if info.variant
    source(
      media='(max-width: 767.98px)'
      srcset=info.variant.srcset
      sizes=info.variant.sizes
      width=info.variant.width
      height=info.variant.height
    )
  img(src=info.src srcset=info.srcset sizes=info.sizes width=info.width height=info.height alt='ヒーロー画像')
```

- `variant` は `src` / `width` / `height` / `srcset` / `sizes` を持つ。`srcset` は `source` の必須属性なので候補が1つでも返る。
- `imageInfo()` に `widths` を渡した場合、`variant` にも同じ幅が適用される。`sizes` は幅記述子のときだけ返るため、そのまま渡してよい。
- `source` の `media` と `sizes` のメディア条件は境界を揃える。
