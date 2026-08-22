# SVG アイコン（スプライト）

`src/` 配下の `icons/` ディレクトリに置いた SVG は、ディレクトリ単位で1つのスプライトにまとめられる。サブディレクトリに分けて置いても、同じ1つのスプライトに入る。

```
src/assets/icons/arrow.svg     →  <outDir>/assets/icons.svg#arrow
src/assets/icons/social/x.svg  →  <outDir>/assets/icons.svg#social/x
```

```pug
svg(width='24' height='24' aria-hidden='true')
  use(href=`${Builder.dir}assets/icons.svg#arrow`)
```

- `icons/` からの相対パスから拡張子を除いたものが `symbol` の id になる。直下に置いた SVG はファイル名がそのまま id になる。
- `fill` / `stroke` は `currentColor` に変換されるため、色は CSS の `color` で指定する。
- `symbol` は id の昇順に並ぶ。同じ入力なら環境が変わっても同じ内容が出るので、`dist` を版管理に入れていても差分が揺れない。
- `icons.svg` はスプライトの出力に使う名前なので、`src/` と `public/` に置かない。詳細は [errors.md](errors.md)。
- インライン SVG の直書きや `img` タグでのアイコン参照より、スプライトを優先する。
- スプライトは build と開発サーバーの両方で自動生成され、`icons/` の変更時も自動で再生成される。手動で生成するときは `pugkit sprite`。

## 単色前提であること

スプライト化すると `fill` / `stroke` が `currentColor` に統一される。多色アイコン・ロゴ・グラデーションを含む SVG を `icons/` に置くと色が壊れるため、これらは `icons/` 以外に置いて通常の SVG として参照する。

`icons/` 以外に置いた SVG は SVGO で最適化されて出力される。
