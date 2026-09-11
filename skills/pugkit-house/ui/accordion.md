# アコーディオン

`details` と `summary` で組む。APG の [Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) が求める開閉と状態の伝達をブラウザが持っているので、Example は写さない。

```pug
details.c-accordion__item(name='faq')
  summary.c-accordion__summary
    h3.c-accordion__title 配送に何日かかりますか
    +Icon('plus', {class: 'c-accordion__icon'})
  .c-accordion__body
    p 通常3日で届きます。
```

SCSS は `components/_accordion.scss`。`details` で組む限り JS は持たず、`data-module` にも載せない。開いている見た目は `[open]` から引き、遷移の時間は `--duration-normal` から取る。

`name` を揃えると同時に1つしか開かない。Firefox 130 より前では無視されて排他にならず、複数を同時に開ける状態になる。中身には到達できる。

見出しは `summary` の中に置く。ボタンとして扱われる要素の中の見出しは支援技術に出ないことがあるので、見出し送りで項目を拾えることが要件に入るなら、APG の `heading > button[aria-expanded]` を写す側に倒す。

`summary` に `role="button"` と `aria-expanded` を書かない。macOS Safari が通常のボタンとして扱い、開閉の状態が読み上げから落ちる。

高さに遷移を付けない。`auto` への遷移を補間できないので、動かすには `open` を保ったまま高さを測る JS が要る。`details` を選んだ理由が消える。回転や色は遷移させてよい。

既定のマーカーは `list-style: none` と `::-webkit-details-marker` の両方で消す。消したら、開いた状態と閉じた状態の差をアイコン1つに頼らない。背景色や区切り線も一緒に変える。
