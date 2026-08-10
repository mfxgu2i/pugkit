# SVG アイコン（スプライト）

`src/` 配下の `icons/` ディレクトリに置いた SVG は、ディレクトリ単位で1つのスプライトにまとめられる。

```
src/assets/icons/arrow.svg  →  <outDir>/assets/icons.svg#arrow
```

```pug
svg(width='24' height='24' aria-hidden='true')
  use(href=`${Builder.dir}assets/icons.svg#arrow`)
```

- ファイル名がそのまま `symbol` の id になる。
- `fill` / `stroke` は `currentColor` に変換されるため、色は CSS の `color` で指定する。
- インライン SVG の直書きや `img` タグでのアイコン参照より、スプライトを優先する。
- スプライトは build と開発サーバーの両方で自動生成され、`icons/` の変更時も自動で再生成される。手動で生成するときは `pugkit sprite`。

## 単色前提であること

スプライト化すると `fill` / `stroke` が `currentColor` に統一される。多色アイコン・ロゴ・グラデーションを含む SVG を `icons/` に置くと色が壊れるため、これらは `icons/` 以外に置いて通常の SVG として参照する。

`icons/` 以外に置いた SVG は SVGO で最適化されて出力される。

## mixin にまとめる

同じ参照を繰り返す場合は mixin に包む。プロジェクトに既存のアイコン mixin があればそれを使う。無ければ [../recipes/icon-mixin.md](../recipes/icon-mixin.md) の実装例を参考にする。
