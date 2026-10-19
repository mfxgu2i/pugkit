---
name: pugkit-house
description: |
  pugkit で作る静的サイトの設計と実装の方針。CSS 設計、レイアウト、mixin、JS のモジュール、UI 部品について、どう組むかと置き場、その理由を持つ。

  次の作業を始める前に読む。
  - SCSS を書く。FLOCSS の層、トークン、ブレークポイント、論理プロパティ、トランジション、寸法の責務、BEM の入れ子
  - 開閉やカレントの状態を持たせる。aria と data の属性、:has() での分岐
  - Pug を書く。レイアウトの継承と block、派生レイアウト、ページ定数、セクションの幅と余白、写真の背景
  - 画像、SVG アイコン、head のメタ、パンくず、ホバーの mixin を使う、または作る
  - JS を機能ごとに分ける。data-module での結びつけ、アンカーリンクのスクロール
  - アコーディオン、モーダル、ハンバーガーメニュー、ドロップダウン、タブを組む。モーダルの背後のスクロールを止める
  - Popover API などの新しい機能を採るか決める

  次には使わない。
  - pugkit.config.mjs が無いプロジェクトの HTML や CSS の作業
  - pugkit のコマンド、設定、ビルドの挙動、Builder と imageInfo の API。pugkit skill が持つ
  - フォームのバリデーションやパフォーマンス改善など、UI 部品以外の一般的な Web 実装
---

# pugkit-house

## 前提

このskillは pugkit skill の上に載る層になる。ツールの使い方はそちらが持つので、先に読む。

ここにあるのは、どう実装して欲しいかという方針と手順、その理由になる。実装の全文は持たない。書くときは、各ファイルの手順と制約を満たすコードをその場で書く。理由が添えてある制約は、別の書き方を選ぶときにも守る。

SCSS、Pug、JS を書き始める前に、下の表から作業に当たるファイルを読む。書いてから読むと、一般的な書き方で組んだものを後から直すことになる。

## 設計

どの層に何を置くか、値をどう持つか、レイアウトをどう分けるかを決める。

| やること | 読むファイル |
|---|---|
| どの層でも守るプロパティの書き方を確かめる | [design/properties.md](design/properties.md) |
| ファイルをどの層に置くか決める、クラス名のプレフィックスを決める | [design/flocss.md](design/flocss.md) |
| 変数を定義する、色や文字サイズを追加する、px と rem を使い分ける | [design/tokens.md](design/tokens.md) |
| メディアクエリを書く、ブレークポイントを決める | [design/breakpoints.md](design/breakpoints.md) |
| カンプの比率を画面幅に追従させるか判断する | [design/font-ratio.md](design/font-ratio.md) |
| 子要素のサイズを決める、BEMの要素を重ねるか判断する | [design/components.md](design/components.md) |
| 開閉やカレントを持たせる、中身の有無で見た目を変える | [design/state.md](design/state.md) |
| ページの土台を作る、レイアウトを派生させる、ページ固有の定数を置く、セクションの幅と余白を決める、写真を背景に敷く | [design/layout.md](design/layout.md) |

## mixin

各 mixin が満たす振る舞いと、呼び出しの形を持つ。Pug の mixin は `_templates/mixins/`、SCSS の mixin は `foundation/mixins/` に置く。ファイルの先頭には引数と使用例をコメントで書く。読む側が実装を追わずに使い方を掴める。

まず置き場を見て、あるものを使う。無ければ、ここに書いた振る舞いを満たすように書く。あるものの挙動がここと違うときは、どちらが正しいかを確かめてから決める。既存の実装が誤っていることもある。

| やること | 読むファイル |
|---|---|
| ホバーの見た目を書く | [mixins/hover.md](mixins/hover.md) |
| 画像を出力する | [mixins/image.md](mixins/image.md) |
| SVGアイコンを出力する | [mixins/icon.md](mixins/icon.md) |
| head のメタ情報を出力する | [mixins/meta.md](mixins/meta.md) |
| パンくずリストと構造化データを出す | [mixins/breadcrumb.md](mixins/breadcrumb.md) |

## スクリプト

ファイルの分け方と、個々の機能の組み方。組み方は mixin と同じく、まず既存の実装を見て、あるものを使う。無ければ手順に沿って書く。分け方のほうは既存の実装が合っているかを判定する基準なので、合っていなければ既存側を直す。

| やること | 読むファイル |
|---|---|
| ファイルを分ける、main.js に組み込む、機能をマークアップに結びつける、遅延読み込みやバンドル分割を検討する | [scripts/modules.md](scripts/modules.md) |
| アンカーリンクでスクロールさせる、ページ先頭へ戻す | [scripts/smooth-scroll.md](scripts/smooth-scroll.md) |

## UI部品

UI は APG のパターンに従って組む。ただし `dialog` と `details` が使える場面では、Example を写さずにその要素を使う。ネイティブの要素で表現できるものを ARIA より優先するのは、W3C の [Using ARIA](https://www.w3.org/TR/using-aria/#rule1) の第一の規則になる。APG の Accordion と Dialog のパターンがこの2つに触れないのは、要素が広く実装される前に書かれたパターンだからで、使ってはいけないという意味ではない。

| やること | APG | 使うもの | 読むファイル |
|---|---|---|---|
| 開閉する項目を並べる | Accordion | `details` と `summary` | [ui/accordion.md](ui/accordion.md) |
| 前面に出して操作を割り込ませる | Dialog (Modal) | `dialog` と `showModal()` | [ui/modal.md](ui/modal.md) |
| ナビやドロップダウンをボタンで開閉する | Disclosure | `button[aria-expanded]` と `nav` | [ui/drawer.md](ui/drawer.md) |
| 内容を切り替えて見せる | Tabs | APG の Example を写す | [ui/tabs.md](ui/tabs.md) |

モーダルとドロワーで共有する背後の扱いは [ui/scroll-lock.md](ui/scroll-lock.md) にある。

実装の全文は持たない。APG の該当する Example への案内と、pugkit での置き場と命名、その UI 固有の判断だけを書く。まず既存の実装を見て、あるものを使う。ただし既存が状態をクラスで持っていたり、要素が持つ属性を手で書いていたりする場合は、踏襲せずに直す。どちらも読み上げに関わるので、既存に揃えるより正すほうを優先する。

### 標準要素に置き換えてよいか

一覧にない UI も同じ順で決める。APG のどのパターンに当たるかを決め、次の4つがすべて通る標準要素があればそれを使う。1つでも欠けたら Example を写す。

| 見るところ | 通っている状態 |
|---|---|
| キーボード操作 | APG の Keyboard Interaction の表を、JS を足さずに満たす |
| 状態の伝達 | `aria-expanded` や `aria-selected` に当たるものを暗黙で持つ |
| フォーカス | 開いた先と閉じたあとの行き先が APG と同じになる |
| 構造の露出 | APG が求める見出しやランドマークが、そのまま支援技術に出る |

`dialog` は4つとも通る。`details` は構造の露出だけ通らないので、[ui/accordion.md](ui/accordion.md) で条件を分けている。

要素が持っている属性は手で書かない。書くと無害な重複では済まず、ブラウザが持っていた振る舞いのほうが消える。要素ごとの壊れ方は各ファイルにある。

Example を写すと決めたら、SCSS は `components/`、JS は `assets/js/_名前.js` に置き、`data-module` で名乗らせる。ヘッダーやフッターの骨格に当たるものだけ `layouts/` になる。層の決め方は [design/flocss.md](design/flocss.md) を参照。ファイルの形は、案件に既にある UI 部品の JS と SCSS に揃える。

### 新しい機能を採るか

Baseline の段階で決める。段階は時間とともに進むので、判断のたびに [Web Platform Status](https://webstatus.dev/) か MDN の Baseline の表示で確かめる。覚えている段階で決めない。

| 段階 | 採るか |
|---|---|
| Widely available | 採る |
| Newly available | 代わりがあれば代わりで組む。代わりが無く、未対応のブラウザでは素の振る舞いに戻るだけで内容に到達できるなら採る |
| Baseline に入っていない | 採らない |

UI 部品で判断が分かれやすいものと、採らないときの代わりは次のとおり。

| 機能 | 採らないときの代わり |
|---|---|
| Popover API | `aria-expanded` と `:has()` と `inert` で組む |
| `command` と `commandfor` | `showModal()` を JS から呼ぶ |
| `interpolate-size` と `calc-size()` | `auto` への遷移を補間しない |
| `transition-behavior: allow-discrete` による `display` の遷移 | ドロワーは `visibility` で代える。`dialog` は代わりが無いので閉じるときの演出を諦める |

`details` の `name` と `scrollbar-gutter` は代わりが無く、未対応のブラウザでは素の振る舞いに戻るだけなので採る。

## 書き終えたら

読んだファイルと照らし合わせてから終える。「やってはいけないこと」に当たる書き方と、理由が添えてある制約を外した箇所が無いかを見る。あれば直す。既存のコードに合わせた結果として外れたものも、同じように直す。

## 扱わない範囲

| 対象 | 参照先 |
|---|---|
| `Builder` と `imageInfo()` のAPI、ファイルの解決規則、設定、コマンド | pugkit skill |
| フォームやパフォーマンスなど、UI部品以外の一般的なWeb実装 | modern-web-guidance skill |

`pugkit.config.mjs` が無いプロジェクトでは使わない。ここにある方針は pugkit の出力規則とディレクトリ構成を前提にしている。
