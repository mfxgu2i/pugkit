---
name: pugkit-house
description: pugkit で作る静的サイトの設計と実装の型。CSS設計(FLOCSSの層・トークン・ブレークポイント)、コンポーネント設計(寸法の責務・BEMの入れ子)、状態(aria/dataの属性・:has()での分岐)、プロパティの書き方(論理プロパティ・トランジション)、レイアウト設計(pugの継承・block構成と派生レイアウト)、画像・アイコン・head メタ・セクション・パンくず・ホバーのmixin実装、JSのモジュール分割とスムーススクロールの実装、アコーディオン・モーダル・ハンバーガーメニュー・ドロップダウン・タブの組み方の判断と置き場(APGを基本に、dialogとdetailsが使える場面は標準要素)、背後のスクロールを止める型、Popover APIを採らない判断を持つ。SCSSを書く、Pugのマークアップを書く、レイアウトやコンポーネントやmixinを作る、JSを機能ごとに分ける、アンカーリンクのスクロールを実装する、開閉や切り替えのあるUIをアクセシブルに作る、モーダルを開いたときに背景が動くのを止めるときに使う。pugkit skill の上に載る層で、Builder や imageInfo のAPIそのものはそちらが持つ。次の3つには使用しないこと。pugkit.config.mjs が無いプロジェクトのHTML/CSS作業。pugkit のコマンド・設定・ビルドの挙動(pugkit skill が持つ)。フォームのバリデーションやパフォーマンス改善など、UI部品以外の一般的なWeb実装。
---

# pugkit-house

## 前提

このskillは pugkit skill の上に載る層になる。ツールの使い方はそちらが持つので、先に読む。

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
| ページの土台を作る、レイアウトを派生させる、ページ固有の定数を置く | [design/layout.md](design/layout.md) |

## mixin

写して使う実装。Pug の mixin は `_templates/mixins/`、SCSS の mixin は `foundation/mixins/` に置く。ファイルの先頭には引数と使用例をコメントで書く。読む側が実装を追わずに使い方を掴める。

ゼロから作るときの型なので、いまある実装と一致するとは限らない。まず置き場を見て、あるものを使う。挙動が違うときは、どちらが正しいかを確かめてから決める。既存の実装が誤っていることもある。

| やること | 読むファイル |
|---|---|
| ホバーの見た目を書く | [mixins/hover.md](mixins/hover.md) |
| セクションを積み上げる、外枠と背景を作る | [mixins/wrapper.md](mixins/wrapper.md) |
| 画像を出力する | [mixins/image.md](mixins/image.md) |
| SVGアイコンを出力する | [mixins/icon.md](mixins/icon.md) |
| head のメタ情報を出力する | [mixins/meta.md](mixins/meta.md) |
| パンくずリストと構造化データを出す | [mixins/breadcrumb.md](mixins/breadcrumb.md) |

## スクリプト

ファイルの分け方と、写して使う実装。写して使う実装は mixin と同じく、ゼロから作るときの型になる。まず既存の実装を見て、あるものを使う。分け方のほうは既存の実装を測る規則なので、合っていなければ既存側を直す。

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

実装の全文は持たない。APG の該当する Example への案内と、pugkit での置き場と命名、その UI 固有の判断だけを書く。まず既存の実装を見て、あるものを使う。ただし既存が状態をクラスで持っていたり、要素が持つ属性を手で書いていたりする場合は、踏襲せずに直す。読み上げに関わる分だけ、揃えるより正すほうが先になる。

### 標準要素に置き換えてよいか

一覧にない UI も同じ順で決める。APG のどのパターンに当たるかを決め、次の4つがすべて通る標準要素があればそれを使う。1つでも欠けたら Example を写す。

| 見るところ | 通っている状態 |
|---|---|
| キーボード操作 | APG の Keyboard Interaction の表を、JS を足さずに満たす |
| 状態の伝達 | `aria-expanded` や `aria-selected` に当たるものを暗黙で持つ |
| フォーカス | 開いた先と閉じたあとの行き先が APG と同じになる |
| 構造の露出 | APG が求める見出しやランドマークが、そのまま支援技術に出る |

`dialog` は4つとも通る。`details` は構造の露出だけ通らないので、[ui/accordion.md](ui/accordion.md) で条件を分けている。

要素が持っている属性は手で書かない。無害な重複ではなく、ブラウザが持っていた振る舞いのほうが消える。要素ごとの壊れ方は各ファイルにある。

写す側に倒したら、SCSS は `components/`、JS は `assets/js/_名前.js` に置き、`data-module` で名乗らせる。ヘッダーやフッターの骨格に当たるものだけ `layouts/` になる。層の決め方は [design/flocss.md](design/flocss.md) を参照。ファイルの形は既存の4部品に揃える。

### 使わないもの

代わりが安く付くものは採らない。

| 使わないもの | 理由 |
|---|---|
| Popover API | iOS Safari は 18.3 から。ポリフィルと `:popover-open` の手当てが要る |
| `command` と `commandfor` | Safari は 26.2 から。JS 無しでモーダルを開けるが、同じ理由で採らない |
| `interpolate-size` と `calc-size()` | Limited availability。`auto` への遷移を補間できない |
| `transition-behavior: allow-discrete` | Firefox が `display` の遷移に未対応。ドロワーは `visibility` で代替でき、`dialog` は代替が無いので閉じの演出を諦める |

代わりが無いものは、対応が新しくても採る。`details` の `name` は Firefox 130 から、`scrollbar-gutter` は2024年12月からになる。採るかどうかは、対応していないブラウザで何が起きるかで決める。

## 扱わない範囲

| 対象 | 参照先 |
|---|---|
| `Builder` と `imageInfo()` のAPI、ファイルの解決規則、設定、コマンド | pugkit skill |
| フォームやパフォーマンスなど、UI部品以外の一般的なWeb実装 | modern-web-guidance skill |

`pugkit.config.mjs` が無いプロジェクトでは使わない。ここにある型は pugkit の出力規則とディレクトリ構成を前提にしている。
