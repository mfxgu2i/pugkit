# pugkit

<p>
  <a aria-label="License" href="https://github.com/mfxgu2i/pugkit/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
</p>

## Documentation

https://github.com/mfxgu2i/pugkit/blob/main/packages/pugkit/README.md

## About

pugkitは静的サイト制作に特化したビルドツールです。
納品向きの綺麗なHTMLと、ファイル構成に制約のないアセットファイルを出力可能です。

## Philosophy

### 100%静的出力

pugkitが生成するHTMLは、納品案件・WordPressやMovableTypeなどのCMSテンプレートに組み込むことを前提としています。不要なコードを含まない、クリーンな出力を重視しています。

### プロジェクトに合わせた柔軟な構成

アセットのファイル構成はプロジェクトごとに異なります。pugkitはディレクトリ構成を強制せず、案件の要件に合わせた自由な構成を可能にします。

### 設定ファイルによるカスタマイズ

`pugkit.config.mjs` 一つで出力設定を管理できます。他のモダンなビルドツールに近い設計思想を採用しており、Node.jsの深い知識がなくても導入・運用できることを目指しています。

## Packages

| Package                                   | Version                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [pugkit](./packages/pugkit)               | [![npm](https://img.shields.io/npm/v/pugkit.svg?style=flat-square&labelColor=212121)](https://www.npmjs.com/package/pugkit)               |
| [create-pugkit](./packages/create-pugkit) | [![npm](https://img.shields.io/npm/v/create-pugkit.svg?style=flat-square&labelColor=212121)](https://www.npmjs.com/package/create-pugkit) |

## Quick Start

```bash
npm create pugkit@latest
```

## 開発者向けドキュメント

pugkit 自体を触る人向け。使い方は上の Documentation を参照してください。

| 文書                                              | 内容                                             |
| ------------------------------------------------- | ------------------------------------------------ |
| [architecture.md](./docs/architecture.md)         | 全体の組み立てと、守るべき不変条件               |
| [adr/](./docs/adr/)                               | 設計判断の記録。なぜその形なのか、何を却下したか |
| [testing.md](./docs/testing.md)                   | テストの層分けと書き方の指針                     |
| [release.md](./docs/release.md)                   | リリース手順                                     |
| [todo.md](./docs/todo.md)                         | 既知の課題と、判断済みで今はやらないこと         |
| [planned-features.md](./docs/planned-features.md) | やると決めていて、まだ手を付けていないもの       |

### 開発の始め方

```bash
npm install
npm test                # 全テスト
npm run test:watch      # unit だけを watch（TDD 用）
```

pugkit 自体にビルド手順はありません。`packages/pugkit/` の `.mjs` がそのまま公開されます。

実際のプロジェクトに対して動かすには、テンプレートを一時ディレクトリへ複製して
リポジトリの pugkit を指させます。手順は [release.md](./docs/release.md) の
「リリース前の確認」にあります。CLI 特有の壊れ方はテストでは拾えないため、
挙動を変えたときはこの確認を通してください。

コミットメッセージは `<type>: <subject>` の形式で、終止形で書きます
（`feat` / `fix` / `docs` / `refactor` / `test` / `chore`）。
破壊的変更は `feat!` のように `!` を付けます。
