# モーダル

`dialog` と `showModal()` で組む。APG の [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) が JS で書いているフォーカスの閉じ込め、Escape、復帰フォーカス、top layer をブラウザが持つので、Example は写さない。

```pug
button(type='button' data-module='modal' aria-controls='contact-modal') 問い合わせる

dialog#contact-modal.c-modal(aria-labelledby='contact-modal-title')
  .c-modal__inner
    h2#contact-modal-title.c-modal__title(tabindex='-1' autofocus) 問い合わせ
    button.c-modal__close(type='button' data-modal-close) 閉じる
```

SCSS は `components/_modal.scss`、JS は `assets/js/_modal.js`。ルートは開くボタンで、`aria-controls` が指す `dialog` を1つだけ引く。JS が持つのは `showModal()` と `close()` の呼び出しだけになる。

`command` と `commandfor` を採れるなら、開くボタンに `commandfor='contact-modal' command='show-modal'`、閉じるボタンに `commandfor='contact-modal' command='close'` を書き、JS を置かない。採るかどうかは [../SKILL.md](../SKILL.md) の「新しい機能を採るか」で決める。

`role="dialog"` と `aria-modal="true"` を書かない。`dialog` が暗黙で持つ。`show()` を使わない。背後が inert にならず、閉じ込めも Escape も付いてこない。

閉じるボタンは `form(method='dialog')` で包めば JS 無しで閉じられる。閉じる口が1つならそれでよい。ヘッダーとフッターに分かれるなど複数になると、そのたびに意味の無い `form` が増えるので、`data-modal-close` と JS に寄せている。

`autofocus` を書く。書かないとブラウザは最初のフォーカスできる要素へ移すので、閉じるボタンしか無いダイアログでは末尾の閉じるボタンにフォーカスが移る。

中身を `.c-modal__inner` で包み、`dialog` 自体に余白を持たせない。スクロールを内側に閉じ込めないと、スクロールバーのクリックが背景の判定に入る。背景クリックで閉じるなら、押し始めと離した先の両方が `dialog` のときだけ閉じる。こうすると本文からのドラッグで閉じなくなる。

暗幕は `::backdrop` に当てる。色はトークンから取り、無ければ `_tokens.scss` に足す。背後のスクロールは `showModal()` では止まらないので、[scroll-lock.md](scroll-lock.md) の型を併せて置く。

閉じるアニメーションは `transition-behavior: allow-discrete` を採れるかで決まる。`open` が外れた瞬間に UA スタイルの `dialog:not([open])` が `display: none` にするので、`display` と `overlay` を遷移に含めないと消える演出が付かない。採らないなら、閉じるアニメーションを付けない。判断は [../SKILL.md](../SKILL.md) の「新しい機能を採るか」の表に従う。
