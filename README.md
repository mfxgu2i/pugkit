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

| スキル                                | 中身                                                                                                                   | 同梱   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| [pugkit](./skills/pugkit)             | ビルド仕様とAPI。`Builder`によるパスの組み立て、`imageInfo()`を通した画像の出力、`_`によるビルド対象の除外を守らせます | する   |
| [pugkit-house](./skills/pugkit-house) | pugkitの上に載る設計の型。FLOCSSの層とトークン、レイアウトのblock構成、mixinのレシピを持ちます                         | しない |

`npm create pugkit@latest` で作成したプロジェクトには、pugkitが次の場所へ同梱されます。

| ディレクトリ             | 対応するエージェント |
| ------------------------ | -------------------- |
| `.claude/skills/pugkit/` | Claude Code          |
| `.github/skills/pugkit/` | GitHub Copilot       |

既存のプロジェクトに追加する場合は、Agent Skills対応のエージェンティックコーディングツールから次のコマンドで導入します。どちらを入れるかは対話で選べます。

```bash
npx skills add mfxgu2i/pugkit
```

### pugkit-house

pugkitの上に、繰り返し使う設計と実装の型を足すスキルです。SCSSをFLOCSSの層に分け、値をトークンで持ち、`+Wrapper`でセクションを積み上げる前提で書かれています。

最新のpugkitを前提にします。古い版のプロジェクトでは、`Builder` と `imageInfo()` を使う記述が実際の挙動と合いません。

スキャフォールドしたプロジェクトには同梱しません。テンプレートはこの型に沿っていないため、入れると存在しない層とmixinを前提にした指示になります。この型で組むときだけ足してください。

```bash
npx skills add mfxgu2i/pugkit --skill pugkit-house
```
