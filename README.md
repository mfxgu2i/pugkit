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

## AI Agent Skill

AIコーディングエージェント向けの公式の[Agent Skill](https://github.com/agentskills/agentskills)を2つ提供しています。

| スキル                                | 中身                                                                                                                   | 既定 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| [pugkit](./skills/pugkit)             | ビルド仕様とAPI。`Builder`によるパスの組み立て、`imageInfo()`を通した画像の出力、`_`によるビルド対象の除外を守らせます | 入る |
| [pugkit-house](./skills/pugkit-house) | pugkitの上に載る設計の型。FLOCSSの層とトークン、レイアウトのblock構成、mixinの実装を持ちます                           | 選ぶ |

`npm create pugkit@latest` は、どのスキルを入れるかを対話で聞きます。既定では pugkit だけが選ばれています。選んだスキルは次の場所へ置かれます。

| ディレクトリ      | 対応するエージェント |
| ----------------- | -------------------- |
| `.claude/skills/` | Claude Code          |
| `.github/skills/` | GitHub Copilot       |

対話できない環境では聞かずに既定で進みます。あらかじめ決めておく場合は名前を渡します。

```bash
npm create pugkit@latest my-site -- --skills pugkit,pugkit-house
```

既存のプロジェクトに追加する場合は、Agent Skills対応のエージェンティックコーディングツールから次のコマンドで導入します。どちらを入れるかは対話で選べます。

```bash
npx skills add mfxgu2i/pugkit
```

### pugkit-house

pugkitの上に、繰り返し使う設計と実装の型を足すスキルです。
SCSS設計、PUGのコンポーネント・レイアウト設計が追加されていています。

```bash
npx skills add mfxgu2i/pugkit --skill pugkit-house
```
