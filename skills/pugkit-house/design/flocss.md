# FLOCSS の層とプレフィックス

## ディレクトリ構成

```
src/assets/css/
├── style.scss          各層を @use で順に読み込むだけ
├── foundation/         variables、tokens、reset、base、functions、mixins
├── layouts/            ページ全体の骨格
├── components/         再利用するUI部品
├── projects/           ページ固有のスタイル
└── utilities/          単機能のユーティリティ
```

`style.scss` は層を読む順序だけを持つ。この順序が詳細度の前提になるので入れ替えない。

```scss
@use 'foundation';
@use 'layouts';
@use 'components';
@use 'projects';
@use 'utilities';
```

各層には `_index.scss` を置き、その層のファイルを `@use` でまとめる。新しいファイルを足したら `_index.scss` への追記を忘れない。追記しないとビルドに含まれない。

## プレフィックスと層の対応

| 層 | プレフィックス | 例 |
|---|---|---|
| layouts | `l-` | `.l-header` |
| components | `c-` | `.c-wrapper` `.c-button` |
| projects | `p-` | `.p-top-hero` |
| utilities | `u-` | `.u-container` |

foundation は要素セレクタと CSS 変数だけを持ち、クラスを定義しない。変数の置き場所は [tokens.md](tokens.md) を参照。

## どの層に置くか

| 条件 | 層 |
|---|---|
| 複数ページで使い回す部品 | components |
| そのページでしか出てこない | projects |
| 1つのプロパティ群だけを担う単機能 | utilities |
| ヘッダーやフッターなど全ページ共通の骨格 | layouts |

判断に迷ったら projects に置く。使い回すことが分かった時点で components に移す。先に components に置くと、実際には1ページでしか使わないものが溜まる。

## ファイル名

ファイル名はクラス名からプレフィックスを外した kebab-case にする。`.c-arrow-button` なら `components/_arrow-button.scss`。
