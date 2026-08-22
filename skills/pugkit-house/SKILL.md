---
name: pugkit-house
description: pugkit で作る静的サイトの設計と実装の型。CSS設計(FLOCSSの層・トークン・ブレークポイント)、コンポーネント設計(寸法の責務・BEMの入れ子)、状態(aria/dataの属性・:has()での分岐)、プロパティの書き方(論理プロパティ・トランジション)、レイアウト設計(pugの継承・block構成と派生レイアウト)、画像・アイコン・head メタ・セクション・パンくず・ホバーのmixin実装を持つ。SCSSを書く、Pugのマークアップを書く、レイアウトやコンポーネントやmixinを作るときに使う。pugkit skill の上に載る層で、Builder や imageInfo のAPIそのものはそちらが持つ。次の3つには使用しないこと。pugkit.config.mjs が無いプロジェクトのHTML/CSS作業。pugkit のコマンド・設定・ビルドの挙動(pugkit skill が持つ)。ダイアログ・スクロール・フォーム・パフォーマンスなど一般的なWeb実装のパターン。
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

## 扱わない範囲

| 対象 | 参照先 |
|---|---|
| `Builder` と `imageInfo()` のAPI、ファイルの解決規則、設定、コマンド | pugkit skill |
| 一般的なWeb実装のベストプラクティス | modern-web-guidance skill |

`pugkit.config.mjs` が無いプロジェクトでは使わない。ここにある型は pugkit の出力規則とディレクトリ構成を前提にしている。
