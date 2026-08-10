# pugkit アーキテクチャ

pugkit を保守する人のための文書。何をしているかはコードを読めば分かるので、
ここでは全体の組み立てと、コードだけでは読み取れない前提を書く。

個々の判断の経緯は `docs/adr/` にある。

## 全体像

### build コマンド

```
pugkit build
  │
  ├─ 設定を読む（config/main.mjs）
  │    outDir の安全性をここで検査し、危険なら中止する
  │
  ├─ 出力先の衝突を検査（core/output-conflicts.mjs）
  │    消す前に確かめる。中止するなら前回の成果物は残す
  │
  ├─ outDir を削除して作り直す
  │
  ├─ [ sass │ script │ sprite ]   並列
  ├─ [ pug ]                      CSS/JS の出力を参照するため後
  └─ [ image │ svg │ copy ]       並列
```

レイヤーは `core/builder.mjs` の `BUILD_PHASES` が持つ。同じレイヤーのタスクは並列に走る。

### dev コマンド

```
pugkit dev
  │
  ├─ 起動シーケンス（core/dev/startup.mjs）
  │    1. ポートの空きを確認
  │    2. cacheDir を作り直す
  │    3. 出力先の衝突を検査
  │    4. Pug 以外を初期ビルド
  │
  ├─ ファイル監視を開始（core/watcher.mjs）
  └─ HTTP サーバーを開始（core/server.mjs）
```

中止するのは 1 と 2 だけ。3 と 4 で止めると、cacheDir を作り直した直後に落ちるため、
壊れたソースを直そうとしても起動できない状態になる。

### dev のファイル変更から画面反映まで

```
ファイル保存
  │
  ├─ Pug          キャッシュを無効化 → リロード通知
  │                 ビルドはしない。ブラウザが要求した時に 1 ページ分だけ作る
  │
  ├─ Sass         影響エントリのみ再コンパイル → CSS 差し替え通知
  │                 フルリロードはしない。入力中のフォームを飛ばさないため
  │
  ├─ Script       影響エントリのみ再バンドル → フルリロード
  │
  └─ 画像/SVG/public  再生成 → 参照ページを無効化 → フルリロード
```

## 中心となる概念

### BuildContext

1 回の build、または 1 つの dev セッションが持つ状態の入れ物。
`dev` / `build` を実行するたびに `new BuildContext()` で作られる。

| プロパティ    | 中身                                            |
| ------------- | ----------------------------------------------- |
| `config`      | 解決済みの設定                                  |
| `paths`       | src / public / 出力先                           |
| `cache`       | コンパイル結果・ページ HTML・画像の寸法         |
| `graph` ほか  | 依存グラフ 4 種                                 |
| `imageWidths` | imageInfo() が要求した幅。build で image が読む |
| `resources`   | 常駐リソース（Sass / esbuild）                  |
| `server`      | dev サーバーの操作口。build では null           |

状態がすべてここに集まっているため、同じプロセスで 2 つ目のビルダーを作っても干渉しない。
モジュール変数に状態を置かないのはこのため（[ADR 0007](adr/0007-resources-live-in-context.md)）。

### Task

`(context, options) => Promise<...>` の関数。`Builder.registerTask()` で名前をつけて登録する。

pug / sass / script / image / svg / sprite / copy / server / watch の 9 種類がある。

生成系のタスクは戻り値を持たない。`watch` だけは `FileWatcher` を返し、
`Builder` が停止のために保持する。

`options.changed` が渡されると、そのファイルだけを処理する（dev の監視時）。
sass と script は依存グラフを使って影響エントリに絞り込む。

### paths

書き込み先はモードで変わる。

| 名前         | 意味                                                   |
| ------------ | ------------------------------------------------------ |
| `outputRoot` | このモードでの書き込みルート。dev では cacheDir を指す |
| `output`     | `subdir` を含めた実際の書き込み先。タスクはここに書く  |

dev で `outputRoot` が `dist` にならないのは、outDir を build 専用にしているため
（[ADR 0003](adr/0003-outdir-is-build-only.md)）。

## キャッシュ

すべてメモリ上にのみ存在し、ディスクには保存しない。

| キャッシュ                     | 格納場所                     | dev                            | build            |
| ------------------------------ | ---------------------------- | ------------------------------ | ---------------- |
| Pug コンパイル済みテンプレート | `CacheManager.compiledCache` | セッション中保持               | 保存しない       |
| ページ HTML                    | `CacheManager.pageHtmlCache` | セッション中保持（世代 + LRU） | 使用しない       |
| 画像の寸法                     | `CacheManager.imageSizes`    | セッション中保持               | セッション中保持 |

ページ HTML には世代（epoch）と LRU 上限（64MB）の 2 つの仕掛けがある。
どちらもリクエスト時ビルドを成り立たせるためのもので、狙いは
[ADR 0002](adr/0002-dev-html-lazy-build.md) にある。

読むときに気をつける点として、世代は無効化のたびに進むが、
LRU で捨てるときは進めない。内容が古いのではなく保持をやめるだけだから。

画像の寸法だけ build でも有効なのは、ソースが変わらなければ結果も変わらないため。
テンプレートやページ HTML と違って、production で捨てる理由がない。

## 依存グラフ

すべてメモリ上にのみ存在し、ディスクには保存しない。

| グラフ        | 対象                             | dev                        | build          |
| ------------- | -------------------------------- | -------------------------- | -------------- |
| `graph`       | Pug 間の include 依存            | セッション中保持・随時更新 | ビルド時に構築 |
| `sassGraph`   | Sass の `@use` / `@forward` 依存 | 同上                       | 同上           |
| `scriptGraph` | JS/TS の import 依存             | 同上                       | 同上           |
| `imageGraph`  | Pug から参照される画像           | レンダリング時に構築       | 構築しない     |

build ではグラフを絞り込みに使わない。構築はするが、全ファイルを処理するため出番がない
（[ADR 0001](adr/0001-build-is-always-full.md)）。

`graph` と `imageGraph` は dev でページが最初に要求されてコンパイルされた時に作られる。
キャッシュにあるページには必ず辺が存在するので、パーシャルや画像の変更時に
影響ページを正確に無効化できる。未訪問のページはキャッシュに無いため、
次の要求で最新のソースから作られる。

## モジュール構成

### 全体

| ディレクトリ | 役割                                            |
| ------------ | ----------------------------------------------- |
| `cli/`       | コマンドの入口。引数の解釈とエラー表示          |
| `config/`    | 設定の読み込み・既定値の適用・検証              |
| `core/`      | ビルダー・コンテキスト・キャッシュ・グラフ・dev |
| `tasks/`     | 実際に何かを生成する処理                        |
| `transform/` | 入力を別の形に変える純粋寄りの処理              |
| `generate/`  | ファイルへの書き出し                            |
| `utils/`     | どこからでも使う小さな道具                      |
| `client/`    | ブラウザ側で動くコード                          |

おおまかな依存の向きは `cli` → `index` → `core` → `tasks` → `transform` / `utils`。

ただし `core` から `tasks` への参照が 3 種類ある。どれも意図したもので、
向きを守るために消してはいけない。

出力先の導出（`core/watcher.mjs` と `core/output-conflicts.mjs` が
`*OutputPath` を呼ぶ）。規則の持ち主はタスク自身であるべきで、
呼ぶ側が独自に導出すると生成と削除でずれる。

リクエスト時ビルド（`core/dev/lazy-builder.mjs` が `buildPageHtml` を呼ぶ）。
dev と build で同じ関数を通すためのもの。

幅違いの生成（`core/dev/width-images.mjs` が `writeWidthVariant` を呼ぶ）。
これも dev と build で同じ関数を通すためで、別々に持つと同じ URL が
モードによって違うバイト列になる。

一方で、タスクの生存期間に関わる知識は `core` に持たせない。
どのタスクが常駐プロセスを抱えるかは `core/resources.mjs` を介して隠れており、
`Builder.close()` は個別のタスクを名指ししない（[ADR 0007](adr/0007-resources-live-in-context.md)）。

### dev サーバー

`core/server.mjs` は HTTP と SSE の結線だけを持ち、それ以外は責務ごとに分ける。

| モジュール                     | 役割                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `core/server.mjs`              | HTTP サーバー・SSE・ルーティングの結線               |
| `core/dev/startup.mjs`         | 起動シーケンス                                       |
| `core/watcher.mjs`             | chokidar の結線と、変更の種別ごとの反応              |
| `core/dev/page-candidates.mjs` | URL からページ候補への展開と、ルート配下への封じ込め |
| `core/dev/page-source.mjs`     | URL から src の Pug ソースへの解決                   |
| `core/dev/lazy-builder.mjs`    | リクエスト時ビルドと、同時リクエストの重複排除       |
| `core/dev/width-images.mjs`    | 幅違いの画像のリクエスト時生成                       |
| `core/dev/client-script.mjs`   | 注入するスクリプトタグと、差分適用可否の指紋計算     |
| `core/dev/response.mjs`        | HTML の送出・エラーページ・静的配信の失敗の受け止め  |
| `client/live-reload.js`        | ブラウザ側のライブリロード                           |

## 守るべき不変条件

コードを分けて書くと壊れやすい箇所。壊れても例外にならないものを挙げる。

### URL の解決順は 3 経路で揃える

Pug ページ・`public` 由来の HTML・sirv の静的配信で順序が違うと、
同じ形の URL でも別の階層のファイルが選ばれる。

展開は `core/dev/page-candidates.mjs` に置き、拡張子（`.pug` / `.html`）だけを
差し替えて共有する。sirv に合わせてフラットファイル優先、末尾スラッシュは除去して同順。

### 出力先の導出は生成側と削除側で共有する

`imageOutputPaths` / `svgOutputPath` / `sassOutputPath` / `scriptOutputPath` /
`spriteOutputPath` / `publicOutputPath` を、タスクと watcher の削除処理が共に通る。

規則がずれると、消したはずのファイルが配信され続ける。

出力先の衝突検査（`core/output-conflicts.mjs`）もこれらのうち image / svg / sprite / public の
4 つを通す。CSS と JS は検査の対象外で、同じ名前を取り合う相手が構造上いないため
（[ADR 0005](adr/0005-abort-on-output-conflict.md)）。

幅違い（`@400w`）だけはこの不変条件から外れる。幅は `imageInfo()` の呼び出し側が決めるので、
相対パスからは何が出るか列挙できない（[ADR 0011](adr/0011-image-widths-are-caller-driven.md)）。
生成は集めた要求、削除は出力ディレクトリの走査、衝突検査は名前の予約と、3 つに分かれる。
名前の規則そのものは `utils/image-density.mjs` に集約してあるので、そこを迂回して
独自に組み立てないこと。

### 画像の寸法は生成側と参照側で共有する

生成される画像の実寸と、HTML に焼き込む `width` / `height` がずれると CLS になる。
規則は `utils/image-density.mjs` に集める（[ADR 0006](adr/0006-single-source-image-density.md)）。

### 拡張子の集合は 1 箇所に置く

glob（走査対象）・正規表現（変更の種別判定）・拡張子の読み替えという別々の形で必要になる。
それぞれの場所に書き下すと、片方だけ増えたときに気づけない。
`utils/image-formats.mjs` に集める。

### 変更の種別ごとの反応は、共通の流れと差分に分ける

再生成は「ログ、タスク実行、失敗の受け止め」が共通で、種別ごとに違うのは
タスク名・ログ名・パスの基準（`core/watcher.mjs` の `REBUILD_SPECS`）と、成功後の後処理だけ。

失敗しても投げない。1 つのアセットが壊れても dev サーバーと他のアセットを動かし続ける。

## build の独立性

dev がどんな状態であっても、`build` は常に正しい出力を返す。
そのために次の 4 つを守る。

### プロセスを分ける

`pugkit build` を実行するたびに新しい Node.js プロセスを起動する。
dev が持っていたメモリ状態を引き継がない。

すべて `BuildContext` のインスタンスプロパティなので、
同じプロセスで別のビルダーを作った場合も引き継がれない。

### production ではビルド成果物のキャッシュを参照しない

`pugTask` は常に全ページを glob して処理する。変更検知による絞り込みを持たない。
`CacheManager.setPugTemplate` は production では保存しない。
Sass と Script のインクリメンタル処理も `isDevelopment` の条件で保護する。

例外は画像の実寸で、これは production でも保存・参照する。
ソースが変わらなければ結果も変わらない読み取り結果であり、
1 回のビルドの中で同じ画像を何度も開かないためのもの。ビルドをまたいでは持ち越さない。

### 出力ディレクトリを完全に削除する

ビルド開始前に削除してから再生成する。前回ビルドの残骸を混入させない。

### 依存グラフを絞り込みに使わない

`imageGraph` は dev 専用とし、production のコードパスに含めない。
`sassGraph` と `scriptGraph` は build 中に再構築するが、絞り込みには使わない。

## 設計の優先順位

新しい判断をするときの拠り所。それぞれの根拠は ADR にある。

| 原則                             | 意味                                                       | 根拠                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| build は再現性を優先する         | 同じソースからは必ず同じ出力が出る。速度はここでは求めない | [0001](adr/0001-build-is-always-full.md)                                                                                                            |
| dev は応答性を優先する           | 反映までの時間がプロジェクトの規模に依存しないようにする   | [0002](adr/0002-dev-html-lazy-build.md)                                                                                                             |
| 出力のパスと名前は入力のまま保つ | ハッシュを付けず、専用ディレクトリへも移さない             | [0006](adr/0006-single-source-image-density.md)                                                                                                     |
| 静かに壊れるより、うるさく止まる | 気づけない不具合は、気づける不具合より高くつく             | [0004](adr/0004-cachedir-is-not-persisted.md) / [0005](adr/0005-abort-on-output-conflict.md) / [0008](adr/0008-config-key-mistakes-are-reported.md) |
| 整形は表示を変えない             | 納品する HTML なので、綺麗さより先に同じ見た目であること   | [0009](adr/0009-html-formatting-follows-js-beautify.md)                                                                                             |

最後の 2 つは結びついている。パスと名前を保つ以上、ハッシュ化で衝突を構造的に
避けることができないので、代わりに検知して止める必要がある。
