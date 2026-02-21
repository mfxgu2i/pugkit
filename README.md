# pugkit

## About

pugkitは静的サイト制作に特化したビルドツールです。
納品向きの綺麗なHTMLと、ファイル構成に制約のないアセットファイルを出力可能です。

## Philosophy

### レガシーWebサイト制作を想定した出力

pugkitが生成するHTMLは、納品案件、WordPressやMovableTypeなどのCMSテンプレートに組み込むことを前提としています。不要なコードを含まない、クリーンな出力を重視しています。

### プロジェクトに合わせた柔軟な構成

アセットのファイル構成はプロジェクトごとに異なります。pugkitはディレクトリ構成を強制せず、案件の要件に合わせた自由な構成を可能にします。

### 設定ファイルによるカスタマイズ

`pugkit.config.mjs` 一つで出力設定を管理できます。他のモダンなビルドツールに近い設計思想を採用しており、Node.jsの深い知識がなくても導入・運用できることを目指しています。

## Packages

| Package                                   | Version      |
| ----------------------------------------- | ------------ |
| [pugkit](./packages/pugkit)               | 1.0.0 |
| [create-pugkit](./packages/create-pugkit) | 1.0.0 |

## Quick Start

```bash
npm create pugkit@latest
```

## License

MIT
