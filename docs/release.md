# リリース手順

## ブランチの流れ

```
feature/* → develop → main
```

`develop` が統合先。リリースのときだけ `main` へマージする。

## バージョンの決め方

`packages/pugkit` は semver に従う。判断に迷ったら**利用者の設定やテンプレートが動かなくなるか**で決める。

| 種別      | 例                                                                     |
| --------- | ---------------------------------------------------------------------- |
| **major** | 設定オプションの廃止、Pug ヘルパーの削除、出力先の扱いの変更           |
| **minor** | 設定オプションの追加、新しいタスク、既定の挙動を変えない改善           |
| **patch** | 不具合修正、性能改善、ドキュメント                                     |

コミットメッセージの `!`（`feat!:` / `refactor!:`）が破壊的変更の目印。`main..develop` で拾える。

```bash
git log --oneline main..develop | grep '!:'
```

## 版を上げるとき

**`packages/pugkit` と `create-pugkit/template` は必ず同時に上げる。**

| ファイル                                       | 内容                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| `packages/pugkit/package.json`                 | `version`                                                 |
| `packages/create-pugkit/template/package.json` | `devDependencies.pugkit` の範囲                           |
| `packages/create-pugkit/package.json`          | `version`（テンプレートを変えたら最低でも minor を上げる） |

テンプレートの範囲指定を忘れると、**`create-pugkit` で作った新規プロジェクトが古い pugkit を掴む**。major を上げたときは `^1.6.0` のままだと新版が入らない。

## リリース前の確認

テストが通ることに加えて、**実際にパッケージ化して別プロジェクトで動かす**。テストはすべて絶対パスの一時プロジェクトを使うため、CLI 特有の壊れ方（相対パス指定など）を拾えない。

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

確認すること:

- `build` — 出力ファイル一式、画像の変換と寸法の焼き込み、CSS/JS の圧縮、**ソースマップが混ざっていないこと**
- `dev` — 全ページ 200、CSS は非圧縮＋ソースマップ、JS は `console` を残す、ライブリロードの注入
- `dev` 稼働中に **`outDir` が変化しないこと**（checksum で比較する）
- Ctrl+C で常駐プロセス（Sass / esbuild）ごと終了すること

## 公開

```bash
npm run publish:pugkit
npm run publish:create-pugkit   # テンプレートを変えたときだけ
```

公開後に `develop` を `main` へマージし、タグを打つ。

## 破壊的変更があるとき

CHANGELOG は置いていないので、**利用者が気づける形にしておく**。

- 設定オプションを消した場合、黙って無視されると事故になる（`build.clean` を消したとき、`clean: false` で運用していた利用者の `outDir` が丸ごと削除される、という形の壊れ方をする）
- README から記述を消すだけでなく、**壊れ方が静かなものは移行先を README に残す**か、起動時に検知して止めることを検討する
