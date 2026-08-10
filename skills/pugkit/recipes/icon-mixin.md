# アイコン mixin

SVG スプライトの `svg > use` 参照を包み、サイズとアクセシビリティ属性をまとめて扱う mixin。

**プロジェクトに既存のアイコン mixin があればそれを使う。** これは無い場合に作るための実装例。配置場所・命名・クラス名はプロジェクトの流儀に合わせる。

```pug
mixin Icon(id, args = {})
  -
    const ariaHidden = args.label ? undefined : 'true'
    const ariaLabel = args.label || undefined
    const style = args.size ? `--_icon-size: ${args.size}` : undefined
  svg.c-icon(aria-hidden=ariaHidden aria-label=ariaLabel class=args.class role='img' style=style)
    use(href=`${Builder.dir}assets/icons.svg#${id}`)
```

```scss
.c-icon {
  width: var(--_icon-size, 1em);
  height: var(--_icon-size, 1em);
  vertical-align: middle;
  fill: currentColor;
}
```

## 使い方

```pug
+Icon('arrow')
+Icon('phone', { class: 'button-icon', label: '電話をかける' })
+Icon('close', { size: '24px' })
```

| 引数         | 内容                                                            |
| ------------ | --------------------------------------------------------------- |
| `id`         | アイコン ID（スプライト内の symbol id。元 SVG のファイル名）    |
| `args.class` | 追加するクラス                                                  |
| `args.label` | `aria-label` の値。指定しないと `aria-hidden='true'` が付く     |
| `args.size`  | サイズ（CSS カスタムプロパティ `--_icon-size` に渡す）          |

スプライトの仕様は [../references/svg-icons.md](../references/svg-icons.md) を参照。
