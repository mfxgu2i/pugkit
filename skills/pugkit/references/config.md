# 設定オプション（pugkit.config.mjs）

指定しなかった項目は既定値が使われる。値を変えるときは、その設定が何に効くかをユーザーに確認してから触る。

| オプション                       | 内容                                                                                  | 既定値        |
| -------------------------------- | ------------------------------------------------------------------------------------- | ------------- |
| `siteUrl`                        | サイトのベース URL。`Builder.url` の組み立てに使う                                    | `''`          |
| `subdir`                         | サイトを配置するサブディレクトリ。出力先が `outDir/<subdir>/` になる                   | `''`          |
| `outDir`                         | build の出力先。dev は書き込まない                                                    | `'dist'`      |
| `cacheDir`                       | dev のアセット出力先。`null` で `node_modules/.pugkit/dev`                             | `null`        |
| `server.port`                    | 開発サーバーのポート                                                                  | `5555`        |
| `server.host`                    | 開発サーバーのホスト                                                                  | `'localhost'` |
| `server.startPath`               | 起動ログに表示する URL のパス                                                         | `'/'`         |
| `server.domDiff`                 | ライブリロードで DOM 差分適用を使うか。`false` で常にフルリロード                      | `true`        |
| `build.image.format`             | 画像の出力形式（`'avif'` / `'webp'` / `'compress'`）                                  | `'webp'`      |
| `build.image.sourceDensity`      | `src/` の画像を何倍の原本として扱うか（`1` / `2`）                                    | `2`           |
| `build.image.options.*`          | 形式ごとの Sharp オプション（`avif` / `webp` / `jpeg` / `png`）                        | -             |
| `build.image.artDirectionSuffix` | アートディレクション用画像のサフィックス                                              | `'_sp'`       |
| `build.image.overrides`          | 画像ごとの Sharp オプション。キーは `src/` からの相対パス                              | `{}`          |
| `build.html`                     | HTML 整形オプション（js-beautify にそのまま渡す）                                     | -             |

## sourceDensity の意味

`src/` に置く画像を何倍の原本として扱うかを決める。ここを取り違えると全画像の表示サイズが変わる。

| 値  | 挙動                                                             |
| --- | ---------------------------------------------------------------- |
| `2` | `src/` の画像を2倍解像度の原本として扱う。`@half` を生成し `srcset` に `1x` / `2x` を並べる |
| `1` | 原寸1枚だけ出力する。`srcset` は出ない                           |

等倍の素材しか用意しないプロジェクトで既定の `2` のままにすると、`src` / `width` / `height` が半分の寸法（`@half`）になり、サイト全体の画像が縮む。

## 画像ごとに圧縮を変える

`build.image.overrides` のキーは `src/` からの相対パス。幅違いの出力にも同じ値が掛かる。

```js
build: {
  image: {
    format: 'webp',
    overrides: {
      'assets/img/bg-hero.jpg': { quality: 100 }
    }
  }
}
```

## 実行時の上書き

その実行の間だけ設定を上書きするオプションがある。一覧は [commands.md](commands.md) を参照。

## 設定ミスの扱い

| 状況                                        | 挙動                                          |
| ------------------------------------------- | --------------------------------------------- |
| 廃止されたキーが残っている                  | 中止する（[errors.md](errors.md)）            |
| 未知のキーがある                            | 警告して無視する                              |
| `build.image.format` が不正値               | 警告して `'webp'` として続行                  |
| `build.image.sourceDensity` が不正値        | 警告して `1` として続行（既定の `2` ではない） |
