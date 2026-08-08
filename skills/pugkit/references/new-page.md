# 新規ページの追加

ページは HTML を直接書かず、必ず共通レイアウトを `extends` して作る（レイアウトの block 構成や作成方法は [layout.md](layout.md) を参照）。

## 手順

1. **既存の兄弟ページを開いて構造を確認する。** `extends` 先のレイアウト、`block` 名、`metaData` の上書き方法をそのまま踏襲する。
2. **使うレイアウトを決める**（下の判断基準を参照）。
3. ページファイルを作成する。出力パスは `src/` の構成がそのまま反映される（`src/about/index.pug` → `about/index.html`）。
4. `block append vars` で `metaData` を上書きし、`block contents` に本体を書く。

```pug
//- src/about/index.pug
extends /_templates/_layout

block append vars
  -
    metaData.pageTitle = '会社概要'
    metaData.pageDescription = '会社概要ページの説明。'

block contents
  section.about
    h1 会社概要
```

- `extends` / `include` の `/` 始まりパスは `src/` を起点に解決される。
- head メタ・OGP はレイアウト内の `+Meta(metaData)` が出力するため、ページ側で meta タグを直接書かない。

## レイアウトの選択基準

| 状況 | 判断 |
| ---- | ---- |
| 既存レイアウトの枠（ヘッダー・フッター・head）に収まる通常ページ | **既存レイアウトをそのまま `extends`** する（デフォルトの選択） |
| 同じ追加要素を持つページ群が複数ある（下層ページ共通のパンくず・ページヘッダーなど） | ベースレイアウトを `extends` した**派生レイアウトを作って共有**する（[layout.md](layout.md) を参照） |
| HTML 構造が根本的に異なる（LP・HTML メールなど） | **新しいレイアウトを作る**（[layout.md](layout.md) を参照）。その場合も block 構成はベースレイアウトに揃える |

1ページのためだけに新しいレイアウトを作らない。ページ固有の差分は `block` / `block append` で吸収できないか先に検討する。
