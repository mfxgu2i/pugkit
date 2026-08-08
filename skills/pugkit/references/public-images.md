# public/ 配下の画像

`public/` のファイルは最適化されず、`outDir` のルートにそのままコピーされる。favicon・OGP 画像・PDF・最適化済み画像などが対象。

`imageInfo()` は `src/` に見つからない画像を `public/` からも探すため、`public/` の画像も `src/` の画像と同じように参照できる（`width` / `height` の自動付与、`@2x` の retina 検出も同様に働く）:

```pug
- const info = imageInfo(`${Builder.dir}assets/img/stock/factory.webp`)
img(src=info.src width=info.width height=info.height alt='' loading='lazy')
```

注意点:

- `public/` のファイルはビルドで変換されない。一方で `info.src` の拡張子読み替え（`build.imageOptimization`）は渡したパスに対して適用されるため、`public/` に `.jpg` / `.png` を置くと実在しない `.webp` パスに読み替えられてしまう。**`public/` に置く画像は最終形式（`.webp` / `.avif` / `.svg` など）にしておく。**
- 出力に含めたい静的ファイル（`.htaccess` など）も `public/` に置く。`outDir` は build のたびに中身が削除されるため、直接置いても残らない。
