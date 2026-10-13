# +Icon

用途は SVG スプライトの `svg > use` 参照を包むこと。アクセシビリティ属性の付け方を1か所に集約する。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` | pugkit が提供するグローバル |
| `assets/icons.svg` | `src/` 配下の `icons/` から pugkit が生成するスプライト |

## 呼び出しの形

```pug
+Icon('arrow')
+Icon('phone', { class: 'p-contact__icon', label: '電話をかける' })
```

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `id` | string | 必須 | スプライト内の symbol id。元 SVG のファイル名 |
| `args.label` | string | なし | 読み上げる名前 |
| `args.class` | string | なし | `svg` 要素に付けるクラス |

## 出力するもの

`svg.c-icon` に `role='img'` を付け、中に `use` を1つ置く。`use` の `href` は `` `${Builder.dir}assets/icons.svg#${id}` `` になる。

読み上げの属性は `label` の有無で切り替える。

| `label` | 付ける属性 |
|---|---|
| ある | `aria-label` に `label` の値 |
| 無い | `aria-hidden='true'` |

`.c-icon` は `components/_icon.scss` に置く。寸法は `1em` の正方形にし、`vertical-align: middle` と `fill: currentcolor` を指定する。文字サイズと文字色にそのまま追従させるため。

## やってはいけないこと

mixin に寸法の引数を持たせない。変えたいときは使う側のクラスで決める。

多色アイコンとロゴを `icons/` に置かない。`fill` と `stroke` が `currentColor` に変換されるため、単色でしか出せない。

意味を持つアイコンに `label` を渡し忘れない。文字が併記されていない単独のアイコンリンクは、読み上げで行き先が分からなくなる。逆に、隣に文字があるアイコンには `label` を渡さない。同じ内容が二度読まれる。

スプライトの生成規則と id の決まり方は pugkit skill の `pugkit/references/svg-icons.md` にある。
