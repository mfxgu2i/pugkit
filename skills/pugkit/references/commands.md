# コマンドと開発フロー

Node.js 22 以上が必要。

| コマンド        | エイリアス                    | 用途                                              |
| --------------- | ----------------------------- | ------------------------------------------------- |
| `pugkit`        | `pugkit dev` / `pugkit watch` | ライブリロード付き開発サーバー（Ctrl+C で停止）   |
| `pugkit build`  | -                             | `outDir` への本番ビルド                           |
| `pugkit check`  | -                             | ビルド済み出力の検査                              |
| `pugkit sprite` | -                             | SVG スプライト生成                                |

プロジェクトに npm scripts があればそちらを使う。

## 実行時オプション

設定ファイルの値を、その実行の間だけ上書きする。

| オプション         | 対象コマンド   | 上書きする設定 |
| ------------------ | -------------- | -------------- |
| `--port <port>`    | `pugkit`       | `server.port`  |
| `--host <host>`    | `pugkit`       | `server.host`  |
| `--site-url <url>` | `pugkit build` | `siteUrl`      |

## dev と build の違い

| 対象   | dev                             | build                      |
| ------ | ------------------------------- | -------------------------- |
| HTML   | リクエスト時ビルド + メモリ配信 | 全ページビルドして書き出し |
| CSS/JS | 非圧縮 + ソースマップ           | minify 済み                |
| 出力先 | `cacheDir`                      | `outDir`                   |

開発サーバーは `outDir` に書き込みも読み出しもしない。dev のアセットは `cacheDir`（既定: `node_modules/.pugkit/dev`）に出力される。作業中は開発サーバーで確認し、最終確認は `pugkit build` の出力に対して行う。

## 出力の検査

`pugkit check` はビルドしないので、`pugkit build && pugkit check` の順で実行する。違反が1件でもあれば終了コード 1 を返す。

| 項目         | 内容                                       |
| ------------ | ------------------------------------------ |
| `references` | HTML と CSS に書かれた参照が出力に実在するか |
| `markup`     | 出力 HTML が HTML として妥当か             |

```sh
pugkit check              # 全項目
pugkit check references   # 参照の実在だけ
```

`markup` は markuplint に渡す。テンプレートには設定ファイルだけが入っていて markuplint 自体は入らないので、使うなら `npm i -D markuplint` で入れる。入っていないときは検査せずに知らせて終わるため、通ったからといって妥当とは限らない。markuplint が `warning` や `info` に落としたルールも違反として扱われる。落としたいルールは markuplint の設定で切る。

異常終了したときの読み方は [errors.md](errors.md) を参照。
