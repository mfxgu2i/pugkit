# モーダル

`dialog` と `showModal()` で組む。APG の [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) が JS で書いているフォーカスの閉じ込め、Escape、復帰フォーカス、top layer をブラウザが持つので、Example は写さない。

```pug
button(type='button' data-module='modal' aria-controls='contact-modal') 問い合わせる

dialog#contact-modal.c-modal(aria-labelledby='contact-modal-title')
  .c-modal__inner
    h2#contact-modal-title.c-modal__title(tabindex='-1' autofocus) 問い合わせ
    button.c-modal__close(type='button' data-modal-close) 閉じる
```

SCSS は `components/_modal.scss`、JS は `assets/js/_modal.js`。ルートは開くボタンで、`dialog` は `aria-controls` が指す1つだけを引く。JS が持つのは `showModal()` と `close()` の呼び出しだけになる。

`role="dialog"` と `aria-modal="true"` を書かない。`dialog` が暗黙で持つ。`show()` を使わない。背後が inert にならず、閉じ込めも Escape も付いてこない。

閉じるボタンは `form(method='dialog')` で包めば JS 無しで閉じられる。閉じる口が1つならそれでよい。ヘッダーとフッターに分かれるなど複数になると、そのたびに意味の無い `form` が増えるので、`data-modal-close` と JS に寄せている。

`autofocus` を書く。書かないとブラウザは最初のフォーカスできる要素へ移すので、閉じるボタンしか無いダイアログでは末尾に着地する。

中身を `.c-modal__inner` で包み、`dialog` 自体に余白を持たせない。スクロールを内側に閉じ込めないと、スクロールバーのクリックが背景の判定に入る。背景クリックで閉じるなら、押し始めと離した先の両方が `dialog` のときだけ閉じる。本文からのドラッグで閉じなくなる。

暗幕は `::backdrop` に当てる。色は `--color-backdrop` から取る。背後のスクロールは `showModal()` では止まらないので、[scroll-lock.md](scroll-lock.md) の型を併せて置く。

閉じるアニメーションを付けない。`open` が外れた瞬間に UA スタイルの `dialog:not([open])` が `display: none` にする。残すには `transition-behavior: allow-discrete` が要るが、Firefox が `display` の遷移に未対応なので採らない。
