# タブ

APG の [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) を写す。矢印キーでの移動と `tabindex` の持ち回りを持つ標準要素が無い。自動アクティブ化の Example を見る。静的サイトはパネルが最初から DOM にあるので、Enter を待たせる理由がない。

```pug
.c-tabs(data-module='tabs')
  .c-tabs__list(role='tablist' aria-label='料金プラン')
    button#plan-tabs-tab-1.c-tabs__tab(
      type='button' role='tab' aria-selected='true' aria-controls='plan-tabs-panel-1'
    ) 個人向け
    button#plan-tabs-tab-2.c-tabs__tab(
      type='button' role='tab' aria-selected='false' aria-controls='plan-tabs-panel-2' tabindex='-1'
    ) 法人向け

  #plan-tabs-panel-1.c-tabs__panel(role='tabpanel' aria-labelledby='plan-tabs-tab-1' tabindex='0')
  #plan-tabs-panel-2.c-tabs__panel(role='tabpanel' aria-labelledby='plan-tabs-tab-2' tabindex='0' hidden)
```

SCSS は `components/_tabs.scss`、JS は `assets/js/_tabs.js`。

JS が書き換えるのは `aria-selected` と `tabindex` とパネルの `hidden` の3つ。見た目は CSS が `[aria-selected='true']` から引く。初期の選択状態はマークアップが持つ。

パネルに `display` を当てるなら `[hidden] { display: none }` を併記する。`hidden` を状態の担い手にしている以上、`display: grid` などを当てた瞬間に UA スタイルが負けて、隠したはずのパネルが出る。JS もマークアップも正しいまま CSS だけで壊れるので、原因が追いにくい。

id は `<識別子>-<役割>-<連番>` で付ける。識別子は英字で始め、1ページに2組置くときは変える。

`aria-orientation` を書き換えたら、JS が受けるキーも上下に変える。片方だけ変えると、読み上げと操作が食い違う。

クリックでもタブに `focus()` を当てる。macOS Safari はクリックでボタンにフォーカスを当てないので、roving tabindex だけが動いてフォーカスが取り残される。

タブを拾うときは `tablist` の直下に絞る。`root.querySelectorAll('[role="tab"]')` は子孫を全部拾うので、パネルの中にもう1組あると外側の配列に混ざる。

タブをリンクで作らない。`a[href="#panel"]` に `role="tab"` を付けると、リンクの Enter 起動を矢印操作で上書きすることになる。
