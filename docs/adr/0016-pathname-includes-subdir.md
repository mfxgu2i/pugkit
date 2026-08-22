# 0016. Builder.url.pathname は subdir を含む

## 状況

`Builder.url` は `origin` / `base` / `pathname` / `href` の 4 つを返す。
このうち `pathname` だけが `src/` 起点のパスで、`subdir` を含んでいなかった。

`subdir: 'campaign'` の案件で `/about/index.pug` を開くと、それぞれこうなる。

| プロパティ | 値                                     |
| ---------- | -------------------------------------- |
| `origin`   | `https://example.com`                  |
| `base`     | `https://example.com/campaign`         |
| `pathname` | `/about/`                              |
| `href`     | `https://example.com/campaign/about/`  |

`new URL(href).pathname` は `/campaign/about/` を返すので、名前が同じで意味が違う。
`href` の組み立ても `base + pathname` という、URL 標準には無い関係になっていた。

この食い違いは実際の案件で取り違えを生んでいた。トップページの判定を
``Builder.url.pathname === `${Builder.subdir}/` `` と書いた案件があり、
`subdir` が空だったため偶然動いていた。設定した時点で常に false になる。

[ADR 0015](0015-image-root-relative-paths-are-url-rooted.md) で `imageInfo()` の
ルート相対パスをサイトルート起点の URL として解くようにした結果、
リンクも画像も `${Builder.subdir}` を前置きする規則にそろった。
`pathname` だけが `src/` 空間に残っていた。

## 決定

`pathname` に `subdir` を含める。`href` は `origin + pathname` で組み立てる。

`base` は `origin + subdir` のまま残す。OGP 画像のように
「サイトのベース URL + ルートからのパス」を組み立てる用途があるため。

トップページの判定は `` `${Builder.subdir}/` `` と突き合わせる形になる。
`subdir` が空なら `/` になるので、設定の有無で書き分けなくてよい。

## 理由

`Builder.url` は URL を表す入れ物で、`pathname` はその一部を指す名前になっている。
WHATWG URL と同じ名前を使う以上、同じ意味でないと読んだとおりに動かない。

ルート相対で自分を指すときに、`${Builder.subdir}${Builder.url.pathname}` と
連結する必要がなくなる。連結は値が足りないことへの回避策で、
片方だけ書き換えると壊れる形でもあった。

`check` の突き合わせとも一致する。`core/check/reference-url.mjs` は URL を
`outputRoot` に継ぎ足して実ファイルを探すので、テンプレートが `pathname` を
`href` に書いた場合、変更前は `subdir` の抜けた URL がリンク切れとして報告されていた。

`href = origin + pathname` になり、URL 標準と同じ関係になる。
`base + pathname` は `subdir` が二重になるので、単体テストで固定して気づけるようにした。

## 却下した案

### pathname は据え置き、ルート相対用のプロパティを別に足す

既存の判定を壊さずに済む。`Builder.url.path` のような名前で
`subdir` 込みの値を返せば、連結も要らなくなる。

採らなかったのは、`pathname` と `path` の違いが名前から読み取れないため。
どちらもパスを返すプロパティが 2 つ並ぶと、使い分けを毎回調べることになる。
URL 標準に無い名前を足すより、標準にある名前を標準どおりの意味にするほうがよい。

### トップページ判定用のプロパティを足す

`Builder.url.isTop` のような真偽値を返せば、比較の形を覚えなくて済む。

採らなかったのは、判定の種類が増えたときに同じ数だけプロパティが要るため。
現在地の比較はトップだけでなく、ナビのカレント表示でも使う。
値を 1 つ正しくすれば、比較の書き方は利用側で決められる。

## 結果

破壊的変更になる。`subdir` を設定していて、かつトップページの判定を
`Builder.url.pathname === '/'` と書いている案件では、判定が常に false になる。

`subdir` が空の案件には影響しない。`pathname` は今までと同じ値を返す。

`pathname` を `src/` 配下のパスとして使っている実装は見直しが要る。
現在地から画像の置き場を組み立てているような使い方が該当する。
前置きを外す規則は `utils/subdir.mjs` の `stripSubdir()` にあるが、
テンプレートからは呼べないので `Builder.url.pathname.slice(Builder.subdir.length)` になる。

ADR 0015 と同じリリースに含める。どちらも `subdir` 付きの案件だけが対象で、
分けると同じ利用者に 2 回移行させることになる。
