# リリース手順

## ブランチの流れ

```
feature/* → develop → main
```

`develop` が統合先。リリースのときだけ `main` へマージする。

## バージョンの決め方

`packages/pugkit` は semver に従う。判断に迷ったら、利用者の設定やテンプレートが動かなくなるかで決める。

| 種別  | 例                                                                             |
| ----- | ------------------------------------------------------------------------------ |
| major | 設定オプションの廃止、Pug ヘルパーの削除、出力先の扱いの変更、CLI の引数の廃止 |
| minor | 設定オプションの追加、新しいタスク、新しいコマンド、既定の挙動を変えない改善   |
| patch | 不具合修正、性能改善、ドキュメント                                             |

コミットメッセージの `!`（`feat!:` / `refactor!:`）が破壊的変更の目印。`main..develop` で拾える。

```bash
git log --oneline main..develop | grep '!:'
```

## テンプレートがどう配られるか

手順を間違えやすいので先に書く。

`create-pugkit` の npm パッケージにはテンプレートが入っていない（`files` は `cli` だけ）。
`create-pugkit` は実行時に degit で GitHub から取ってくる。

```js
// packages/create-pugkit/cli/index.mjs
const REPO = 'mfxgu2i/pugkit/packages/create-pugkit/template'
```

ref を指定していないので、取得元はリポジトリのデフォルトブランチ（`main`）になる。

ここから 3 つのことが決まる。

テンプレートを配るのは publish ではなく `main` へのマージ。
`npm run publish:create-pugkit` はテンプレートの中身に影響しない。

`main` にマージした瞬間から、既存の `create-pugkit` 利用者全員に新しいテンプレートが渡る。
古いバージョンの `create-pugkit` を使っていても同じ。

したがって pugkit の公開より先に `main` へマージすると、
まだ npm に無いバージョンを要求するテンプレートが配られる。
逆に遅らせると、新しい pugkit が公開済みなのに古いテンプレートが配られる。

## バージョンを上げるとき

`packages/pugkit` と `create-pugkit/template` は必ず同時に上げる。

| ファイル                                       | 内容                              |
| ---------------------------------------------- | --------------------------------- |
| `packages/pugkit/package.json`                 | `version`                         |
| `packages/create-pugkit/template/package.json` | `devDependencies.pugkit` の範囲   |
| `packages/create-pugkit/package.json`          | `version`（cli を変えたときだけ） |

テンプレートの範囲指定を忘れると、`create-pugkit` で作った新規プロジェクトが古い pugkit を掴む。
major を上げたときは `^1.6.0` のままだと新版が入らない。

## リリース前の確認

テストが通ることに加えて、実際にパッケージ化して別プロジェクトで動かす。テストは公開 API にプロジェクトルートを渡して一時プロジェクトを使うため、cwd を見る CLI 特有の壊れ方を拾えない。

```bash
npm test

# 1. パッケージを作る
cd packages/pugkit && npm pack

# 2. テンプレートを複製して、CLI から叩く
cp -R packages/create-pugkit/template /tmp/pk-check && cd /tmp/pk-check
npm install /path/to/pugkit-X.Y.Z.tgz
npx pugkit build            # コマンドは cwd を見る。引数は無視される
npx pugkit check            # 0 件で通ること
npx pugkit --port 5810      # dev も起動して配信を確認
```

空のディレクトリではなくテンプレートを使う。以下の確認項目は画像・`.browserslistrc`・
`imageInfo()` を前提にしているので、`npm init -y` だけのディレクトリでは 1 つも実行できない。

テンプレートは markuplint を同梱しているので、`check` は markup まで走る。
未導入のときに飛ばす挙動を見たい場合は、`node_modules/markuplint` を退避して確かめる。

### build で確認すること

出力ファイル一式が揃っていること。画像が変換され、寸法が HTML に焼き込まれていること。
CSS と JS が圧縮されていること。

`imageInfo()` に `widths` を渡したページで、`srcset` の候補がすべて dist に実在すること。
ここは pug と image のフェーズをまたぐので、テストが通っていても CLI で一度は見ておく。

ソースマップが混ざっていないこと。

CSS が対象ブラウザに合わせて変換されていること。ここはテンプレートの
`.browserslistrc` を古い対象に書き換えて、出力が変わることで確かめる。
プレフィックスが付き、モダン構文が降りていれば通っている。

```scss
// 確認用に足す .scss
.probe {
  user-select: none;

  @media (400px <= width <= 900px) {
    inset: 0;
  }
}
```

`chrome >= 90` と `safari >= 14` を対象にすると、build の出力はこうなる。
圧縮後なので改行は入らない。

```text
.probe{-webkit-user-select:none;user-select:none}@media (min-width:400px) and (max-width:900px){.probe{top:0;bottom:0;left:0;right:0}}
```

テンプレートの既定（`last 2` 系）では `-webkit-user-select` は付くが、
範囲構文と `inset` はそのまま残る。対象が対応しているので降ろす必要がない。
書き換えの前後で差が出ることが確認したい点で、どちらか一方の出力だけを見ても分からない。

対象ブラウザの解決は browserslist と caniuse-lite に依存する。
出力が想定と違うときは、まず対象がどう展開されたかを見る。

```bash
npx browserslist
```

### dev で確認すること

全ページが 200 を返すこと。CSS は非圧縮でソースマップつき、JS は `console` が残っていること。

`widths` を使ったページで幅違いの画像が 200 を返すこと。dev は起動時に作らず
リクエスト時に生成するので、build とは別の経路になる。

ライブリロードが注入されていること。

CSS のソースマップから `.scss` まで辿れること。`sources` に `.scss` が入っていれば通っている。
Lightning CSS を通すため、Sass のマップを引き継げていないと CSS 止まりになる。

プレフィックスと降格は dev でも効くこと。build と同じ変換が掛かっていないと、
開発中に見えていたものと納品物がずれる。

dev の稼働中に `outDir` が変化しないこと。checksum で比較する。

Ctrl+C で常駐プロセス（Sass / esbuild）ごと終了すること。

## 公開

順序が重要。テンプレートは `main` から配られるので、
pugkit を npm に上げる前にマージすると、存在しないバージョンを要求するテンプレートが配られる。

```bash
# 1. pugkit を公開する
npm run publish:pugkit

# 2. cli を変えたときだけ create-pugkit も公開する
npm run publish:create-pugkit

# 3. 公開を確認してから main へマージする
npm view pugkit version
git switch main && git merge develop && git push

# 4. タグを打つ
```

3 を先にやらない。マージした瞬間にテンプレートが配られるため、
npm に該当バージョンが無いと `npm install` が失敗する。
