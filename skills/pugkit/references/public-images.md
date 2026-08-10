# public/ 配下のファイル

`public/` に置いたファイルは、ディレクトリ構成を保ったまま出力先へコピーされる。`src/` と違って `_` 始まりの除外規則は適用されず、ドットファイルも含めてすべてコピーされる。

変換も縮小もされないため、次の置き場として使う。

- favicon・OGP 画像
- 等倍のまま出したいロゴなどの画像
- PDF や `.htaccess` など、ビルドを通さず出力に含めたいファイル

## public/ の画像を参照する

`imageInfo()` は `src/` に見つからない画像を `public/` からも探すため、`src/` の画像と同じ書き方で参照できる。

```pug
- const info = imageInfo(`${Builder.dir}assets/img/common/logo.svg`)
img(src=info.src width=info.width height=info.height alt='ロゴ')
```

`public/` の画像は変換されないため `src` は元のパスのまま返り、`srcset` は返らない。`widths` を渡すと警告が出る。

## 注意点

- `src/` と `public/` で出力先が同じになるファイルがあると build が中止する。どちらか一方を削除する。
- `@half` と `@<数字>w` で終わる画像名はビルドの予約名。`public/` に置いても build が中止する。
