# アートディレクション（picture / source）

`src/` 配下の画像の隣に `build.imageInfo.artDirectionSuffix`（デフォルト `_sp`）に一致する画像（`hero.jpg` + `hero_sp.jpg`）があると、`imageInfo()` が自動検出して `info.variant` に入れる。

`imageInfo()` には `Builder.dir` を先頭に付けたパスを渡すこと。返り値の `src`（`variant.src` も）は渡したパスの形式を保ち、`Builder.dir` 形式なら subdir の有無に関わらず正しく解決される。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`)
picture
  if info.variant
    source(media='(max-width: 767.98px)' srcset=info.variant.src width=info.variant.width height=info.variant.height)
  img(src=info.src width=info.width height=info.height alt='ヒーロー画像')
```
