# 新規 pugkit プロジェクトの開始

## create-pugkit でスキャフォールド

Node.js 22 以上が必要。新規 pugkit プロジェクトは公式スキャフォールダーでセットアップする。

```sh
npm create pugkit@latest           # カレントディレクトリに作成
npm create pugkit@latest my-site   # ./my-site に作成
```

テンプレートには共通レイアウト、Meta / Image mixin、Sass エントリ、`pugkit.config.mjs`、markuplint の設定が含まれる。スキャフォールド後:

```sh
npm install
```

## テンプレートの構造

スキャフォールド直後の構成:

```
project-root/
├── pugkit.config.mjs         # ビルド設定
├── markuplint.config.mjs     # pugkit check markup の設定
├── mise.toml                 # Node.js のバージョン固定
├── .browserslistrc           # ブラウザターゲット
├── public/                   # 変換せずコピーするファイル
│   ├── favicon.ico
│   └── assets/img/common/ogp.jpg
└── src/
    ├── index.pug             # トップページ
    ├── about/index.pug       # 下層ページの例（extends /_templates/_layout）
    ├── _templates/
    │   ├── _constants.pug    # META_DATA / BREAK_POINTS などの定数
    │   ├── _layout.pug       # 共通レイアウト（head・header・footer を描画）
    │   ├── includes/
    │   │   ├── _header.pug
    │   │   └── _footer.pug
    │   └── mixins/
    │       ├── _Image.pug    # imageInfo() ベースの画像 mixin（+Image）
    │       └── _Meta.pug     # head メタ / OGP を出力する mixin（+Meta）
    └── assets/               # テンプレートの初期配置（場所は自由に変更可）
        ├── css/style.scss    # Sass エントリ
        └── js/main.js        # JS エントリ
```

`src/` 配下のファイルはどこに置いてもディレクトリ構成のまま `outDir` に出力される。`assets/` などの配置はこの構成に固定せず、プロジェクトに合わせて自由に変更してよい。

npm scripts は `start`（dev）/ `build` / `check` / `sprite` が定義されている。

## pugkit.config.mjs の設定

スキャフォールドしたプロジェクトには `pugkit.config.mjs` が含まれる。値を自分の判断で埋めたり変更したりしないこと。
ページ制作を始める前に、以下をそれぞれユーザーに確認する:

| オプション                  | 確認する内容                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `siteUrl`                   | サイトの本番 URL（OGP/canonical に使用する）                          |
| `subdir`                    | サブディレクトリ配信か？（例: `/campaign`）                           |
| `outDir`                    | ビルド出力先はどこか？                                                |
| `build.image.format`        | 画像の出力形式: `'webp'`（既定）/ `'avif'` / `'compress'`             |
| `build.image.sourceDensity` | `src/` に置く画像は2倍解像度か等倍か。既定の `2` は2倍原本として扱い、半分の寸法を表示サイズにする |

```js
// pugkit.config.mjs
import { defineConfig } from 'pugkit'

export default defineConfig({
  siteUrl: 'https://example.com/',
  subdir: '',
  outDir: 'dist',
  build: {
    image: {
      // 'avif' | 'webp' | 'compress'
      format: 'webp',
    }
  }
})
```

補足:

- `outDir` は相対・絶対・ネスト（`htdocs/v2`）・上位（`../htdocs`）パスを受け付ける。
- `outDir` は build 専用で pugkit が占有する。build のたびに中身が削除されるため、出力に含めたいファイルは `public/` に置く。
- `siteUrl` が空のまま `Builder.url` を参照すると警告が出る（OGP や canonical に相対パスが入るため）。
- ブラウザターゲットは `.browserslistrc` か `package.json` の `browserslist` で指定する。
