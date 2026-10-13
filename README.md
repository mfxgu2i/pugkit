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

| Package                                               | Version                                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [pugkit](./packages/pugkit)                           | [![npm](https://img.shields.io/npm/v/pugkit.svg?style=flat-square&labelColor=212121)](https://www.npmjs.com/package/pugkit)                           |
| [create-pugkit-house](./packages/create-pugkit-house) | [![npm](https://img.shields.io/npm/v/create-pugkit-house.svg?style=flat-square&labelColor=212121)](https://www.npmjs.com/package/create-pugkit-house) |

以前の `create-pugkit` は廃止しました。テンプレートの取得元が無くなったため動きません。`create-pugkit-house` を使ってください。

## Quick Start

```bash
npm create pugkit-house@latest
```

SCSSはFLOCSSの層とトークンで、PugはレイアウトとMixinで組んだ状態から始まります。

## AI Agent Skill

AIコーディングエージェント向けの公式の[Agent Skill](https://github.com/agentskills/agentskills)を2つ提供しています。

| スキル                                | 中身                                                                                                                   | 既定 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| [pugkit](./skills/pugkit)             | ビルド仕様とAPI。`Builder`によるパスの組み立て、`imageInfo()`を通した画像の出力、`_`によるビルド対象の除外を守らせます | 入る |
| [pugkit-house](./skills/pugkit-house) | pugkitの上に載る設計と実装の方針。FLOCSSの層とトークン、レイアウトのblock構成、mixinとUI部品が満たす振る舞いを持ちます | 入る |

`npm create pugkit-house@latest` は、どのスキルを入れるかを対話で聞きます。既定では両方が選ばれています。選んだスキルは次の場所へ置かれます。

| ディレクトリ      | 対応するエージェント |
| ----------------- | -------------------- |
| `.claude/skills/` | Claude Code          |
| `.github/skills/` | GitHub Copilot       |

対話できない環境では聞かずに既定で進みます。片方だけにする場合は名前を渡します。

```bash
npm create pugkit-house@latest my-site -- --skills pugkit
```

既存のプロジェクトに追加する場合は、Agent Skills対応のエージェンティックコーディングツールから次のコマンドで導入します。どちらを入れるかは対話で選べます。

```bash
npx skills add mfxgu2i/pugkit
```

### pugkit-house

pugkitの上に、繰り返し使う設計と実装の方針を足すスキルです。
SCSS設計、Pugのコンポーネント・レイアウト設計、mixinとJSとUI部品の組み方を、実装ではなく手順と理由で持ちます。コードは書くときにエージェントがその場で書くので、テンプレートが無い既存のプロジェクトにも入れられます。

```bash
npx skills add mfxgu2i/pugkit --skill pugkit-house
```
