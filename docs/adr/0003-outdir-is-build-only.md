# 0003. outDir は build 専用にする

## 状況

dev と build が同じ `dist` に書いていた頃、次のことが起きていた。

dev はソースマップ付きの非圧縮 CSS を書く。その状態で `dist` をデプロイすると、
本番に開発用の出力が出る。逆に build 直後に dev を起動すると、
`src` から削除したページが `dist` に残っていて、まだ存在するかのように配信される。

「`dist` にあるものが何なのか」が、直前に何を実行したかに依存していた。

## 決定

`outDir` は build だけが使う。dev は書き込みも読み出しもしない。

dev の書き込み先は `cacheDir` にする。
既定は `node_modules/.pugkit/dev`、`node_modules` が無ければ `.pugkit/dev`。

dev が配信するのは `src` と `public` から導かれるものだけとする。

## 理由

「`outDir` にあるもの = 直近の build の成果物」が常に成り立つようになる。
dev を何度動かしても本番成果物は汚れない。

dev 側も「見えているもの = 現在の `src`」が保証される。
前回ビルドの残骸が現在のソースの代わりに見えることがない。

## 却下した案

### dev と build で出力を共有し、dev の生成物だけ後から取り除く

何が dev 由来かを記録しておく必要があり、記録が壊れた時の失敗が静かになる。
分けてしまえば記録そのものが要らない。

## 結果

`node_modules` 配下を既定にしたのは、gitignore 済みで追加設定が要らないため。

レガシー HTML や手置きのアセットを dev でも見たい場合は `public/` に置く。
`public/` は build でも `outDir` にコピーされるので、dev と build で同じものが見える。

`outDir` と `cacheDir` はどちらも中身を丸ごと削除するため、
同じ検査（`utils/safe-dir.mjs`）を通す。

`outDir` は、プロジェクトルート・`src`・`public`・`node_modules` を内包する場合、
または `src`・`public` の配下である場合に、設定の読み込み時点で中止する。

`cacheDir` は禁止対象が少し違う。プロジェクトルート・`src`・`public`・`outDir` を
内包する場合と、`src`・`public`・`outDir` の配下である場合に中止する。

`outDir` との重なりを足しているのは、dev の生成物が本番成果物に混ざらないようにするため。
一方 `node_modules` は外してある。既定の `cacheDir` が `node_modules/.pugkit/dev` なので、
禁じると既定値が通らなくなる。

`node_modules` を内包する指定に対する守りは、この検査ではなく削除前の目印ファイルが担う
（[ADR 0004](0004-cachedir-is-not-persisted.md)）。
