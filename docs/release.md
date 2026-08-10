# リリース手順

## ブランチの流れ

```
feature/* → develop → main
```

`develop` が統合先。リリースのときだけ `main` へマージする。

## バージョンの決め方

`packages/pugkit` は semver に従う。判断に迷ったら、利用者の設定やテンプレートが動かなくなるかで決める。

| 種別  | 例                                                           |
| ----- | ------------------------------------------------------------ |
| major | 設定オプションの廃止、Pug ヘルパーの削除、出力先の扱いの変更 |
| minor | 設定オプションの追加、新しいタスク、既定の挙動を変えない改善 |
| patch | 不具合修正、性能改善、ドキュメント                           |

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

テストが通ることに加えて、実際にパッケージ化して別プロジェクトで動かす。テストはすべて絶対パスの一時プロジェクトを使うため、CLI 特有の壊れ方（相対パス指定など）を拾えない。

```bash
npm test

# 1. パッケージを作る
cd packages/pugkit && npm pack

# 2. 何も無いディレクトリに入れて、CLI から叩く
mkdir /tmp/pk-check && cd /tmp/pk-check
npm init -y && npm install /path/to/pugkit-X.Y.Z.tgz
npx pugkit build .          # 相対パスで叩くこと
npx pugkit . --port 5810    # dev も起動して配信を確認
```

### build で確認すること

出力ファイル一式が揃っていること。画像が変換され、寸法が HTML に焼き込まれていること。
CSS と JS が圧縮されていること。

`imageInfo()` に `widths` を渡したページで、`srcset` の候補がすべて dist に実在すること。
ここは pug と image のフェーズをまたぐので、テストが通っていても CLI で一度は見ておく。

ソースマップが混ざっていないこと。

### dev で確認すること

全ページが 200 を返すこと。CSS は非圧縮でソースマップつき、JS は `console` が残っていること。

`widths` を使ったページで幅違いの画像が 200 を返すこと。dev は起動時に作らず
リクエスト時に生成するので、build とは別の経路になる。

ライブリロードが注入されていること。

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
