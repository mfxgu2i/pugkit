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

pugkitの規約をAIコーディングエージェントに伝える公式の[Agent Skill](https://github.com/agentskills/agentskills)を提供しています。`Builder`によるパスの組み立て、`imageInfo()`を通した画像の出力、`_`によるビルド対象の除外といった、知らないと壊れる仕様をエージェントに守らせます。実体は [`skills/pugkit`](./skills/pugkit) にあります。

`npm create pugkit@latest` で作成したプロジェクトには、次の場所へ同梱されます。

| ディレクトリ             | 対応するエージェント |
| ------------------------ | -------------------- |
| `.claude/skills/pugkit/` | Claude Code          |
| `.github/skills/pugkit/` | GitHub Copilot       |

既存のプロジェクトに追加する場合は、Agent Skills対応のエージェンティックコーディングツールから次のコマンドで導入します。

```bash
npx skills add mfxgu2i/pugkit
```
