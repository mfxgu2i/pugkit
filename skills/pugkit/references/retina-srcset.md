# Retina srcset（1x / 2x）

`src/` 配下の画像の隣に `@2x` 版（`hero.jpg` + `hero@2x.jpg`）があると、`imageInfo()` が自動検出して `info.retina` に入れる。

`imageInfo()` には `Builder.dir` を先頭に付けたパスを渡すこと。返り値の `src`（`retina.src` も）は渡したパスの形式を保ち、`Builder.dir` 形式なら subdir の有無に関わらず正しく解決される。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/hero.jpg`)
- const srcset = info.retina ? `${info.src} 1x, ${info.retina.src} 2x` : undefined
img(src=info.src srcset=srcset width=info.width height=info.height alt='ヒーロー画像')
```

`@2x` 画像がなければ `srcset` は `undefined` になり属性ごと省略されるので、同じコードが両ケースで動く。
