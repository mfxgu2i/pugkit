# 背後のスクロールを止める

モーダルとして扱うものだけ止める。ダイアログと、画面を覆う SP のドロワーが該当する。切り分けは [drawer.md](drawer.md) にある。

`showModal()` は背後を inert にするが、スクロールは止めない。inert が止めるのはヒットテスト、テキスト選択、編集、ページ内検索、フォーカス、支援技術への露出で、ホイールとタッチのスクロールは効いたままになる。

## 止め方

`foundation/_reset.scss` に置く。

```scss
:root {
  scrollbar-gutter: stable;
}

:root:has(dialog:modal) {
  overflow: hidden;
}
```

`dialog[open]` ではなく `dialog:modal` で見る。`show()` で開いた非モーダルのダイアログを拾わない。

ドロワーは覆う幅でだけ止める。`layouts/_header.scss` に置く。

```scss
@use '../foundation' as f;

@include f.media-breakpoint-down(md) {
  :root:has(.l-header__toggle[aria-expanded='true']) {
    overflow: hidden;
  }
}
```

メディアクエリで囲まないと、PC のドロップダウンを開いたときまで止まる。`body` に書かない。`body` の `overflow` がビューポートに伝わるのは `html` 側が `visible` のときだけで、横スクロール止めに `html { overflow-x: hidden }` を入れている案件では何も起きなくなる。

## 止めた瞬間に横へ飛ぶ

`scrollbar-gutter: stable` を常時置くと解消する。`stable` は `overflow` が `auto` と `scroll` と `hidden` のいずれでも溝を残すので、止めた前後で幅が変わらない。置かないと、止めた瞬間にスクロールバーが消えてページが15px前後横へ飛ぶ。追従ヘッダーと中央寄せのコンテンツで目立つ。

overlay scrollbar の環境では溝を作らないが、そちらは元々スクロールバーが場所を取らないので飛ばない。どちらの環境でも結果が揃う。Baseline に入ったのは2024年12月で、対応していないブラウザではいままで通り飛ぶ。置かない場合より悪くはならない。

あふれていない短いページでも右端に1本分の余白ができる。ページの中心をビューポートの中心と一致させたいなら `stable both-edges` にする。空く幅は2倍になる。

JS でスクロールバーの幅を測らない。閉じるときに戻す処理と、開いている間の `resize` の追従が要る。ロックのときだけ `scrollbar-gutter` を付け外ししない。付けた瞬間に溝ができて、飛ぶ向きが変わるだけになる。
