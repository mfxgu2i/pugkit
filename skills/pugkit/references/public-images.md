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

- `src/` の画像・SVG と `public/` で出力先が同じになると build が中止する。どちらか一方を削除する。
- HTML は中止しない。`public/` に置いた HTML は警告のうえ Pug の出力を上書きする。copy が pug のあとに走るため。
- `@half` と `@<数字>w` で終わる画像名は `public/` でも予約名。詳細は [errors.md](errors.md)。
