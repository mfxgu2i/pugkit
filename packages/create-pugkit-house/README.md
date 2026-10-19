# create-pugkit-house

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/create-pugkit-house">
    <img alt="" src="https://img.shields.io/npm/v/create-pugkit-house.svg?style=for-the-badge&labelColor=212121">
  </a>
  <a aria-label="License" href="https://github.com/mfxgu2i/pugkit/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/create-pugkit-house.svg?style=for-the-badge&labelColor=212121">
  </a>
</p>

## About

[pugkit](https://github.com/mfxgu2i/pugkit)の静的サイト制作環境をセットアップします。SCSSはFLOCSSの層とトークンで、PugはレイアウトとMixinで組んだ状態から始まります。設計の方針はAgent Skillの pugkit-house が持ちます。

以前の `create-pugkit` は廃止しました。テンプレートの取得元が無くなったため動きません。

## How To Use

### Interactive

```sh
npm create pugkit-house@latest
```

### With project name

プロジェクト名を指定して作成します。

```sh
npm create pugkit-house@latest my-pugkit-project
```

### Current directory

カレントディレクトリに作成します。

```sh
npm create pugkit-house@latest .
```

## Next Steps

プロジェクト作成後の手順：

```sh
mise install
npm install
npm run start
```

[mise](https://mise.jdx.dev/) を使わない場合は `mise install` を飛ばしてください。Node 22.22.2 以上であれば動きます。

npm 11.19 以降は、依存の install スクリプトのうち `allowScripts` で許可していないものを警告として並べます。npm 12 からは許可していないものを飛ばします。esbuild はこのスクリプトで実行ファイルの整合性を確かめて、必要なら取得し直すので、テンプレートの `package.json` で許可しています。

## HTML の文法チェック

`npm run check` は出力 HTML の参照が実在するかを検査します。HTML として妥当かどうかの検査は [markuplint](https://markuplint.dev/) に任せるので、そこまで見る場合は入れてください。設定ファイル `markuplint.config.mjs` はテンプレートに入っています。

```sh
npm install --save-dev markuplint
```

## Agent Skill

AI コーディングエージェント向けの公式の [Agent Skill](https://github.com/agentskills/agentskills) を2つ入れます。作成時の対話で外せます。

| スキル         | 中身                              |
| -------------- | --------------------------------- |
| `pugkit`       | ビルド仕様とAPI                   |
| `pugkit-house` | pugkit の上に載る設計と実装の方針 |

作成したプロジェクトには次の場所へ配置されます。

| ディレクトリ      | 対応するエージェント |
| ----------------- | -------------------- |
| `.claude/skills/` | Claude Code          |
| `.github/skills/` | GitHub Copilot       |

対話できない環境では、聞かずに両方を入れます。片方だけにする場合は名前を渡します。

```sh
npm create pugkit-house@latest my-site -- --skills pugkit
```

不要な場合はディレクトリごと削除してください。既存のプロジェクトに追加する場合は `npx skills add mfxgu2i/pugkit` を使います。
