# +Icon

用途は SVG スプライトの `svg > use` 参照を包むこと。アクセシビリティ属性の付け方を1か所に集約する。

## 依存

| 依存 | 出どころ |
|---|---|
| `Builder.dir` | pugkit が提供するグローバル |
| `assets/icons.svg` | `src/` 配下の `icons/` から `pugkit sprite` が生成する |

## mixin

```pug
mixin Icon(id, args = {})
  -
    const ariaHidden = args.label ? undefined : 'true'
    const ariaLabel = args.label || undefined
  svg.c-icon(aria-hidden=ariaHidden aria-label=ariaLabel class=args.class role='img')
    use(href=`${Builder.dir}assets/icons.svg#${id}`)
```

```scss
.c-icon {
  inline-size: 1em;
  block-size: 1em;
  vertical-align: middle;
  fill: currentcolor;
}
```

寸法は `1em` を既定にして、変えたいときは使う側のクラスで指定する。mixin に寸法の引数を持たせない。

## 引数

| 引数 | 型 | 既定 | 意味 |
|---|---|---|---|
| `id` | string | 必須 | スプライト内の symbol id。元 SVG のファイル名 |
| `args.label` | string | なし | `aria-label` の値。省略すると `aria-hidden='true'` が付く |
| `args.class` | string | なし | `svg` 要素に付けるクラス |

## 使用例

```pug
+Icon('arrow')
+Icon('phone', { class: 'p-contact__icon', label: '電話をかける' })
```

## やってはいけないこと

多色アイコンとロゴを `icons/` に置かない。`fill` と `stroke` が `currentColor` に変換されるため、単色でしか出せない。

意味を持つアイコンに `label` を渡し忘れない。文字が併記されていない単独のアイコンリンクは、読み上げで行き先が分からなくなる。逆に、隣に文字があるアイコンには `label` を渡さない。同じ内容が二度読まれる。

mixin に寸法の引数を持たせない。使う側のクラスで決める。

スプライトの生成規則と id の決まり方は pugkit skill の `pugkit/references/svg-icons.md` にある。
