# create-pugkit

<p>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/create-pugkit">
    <img alt="" src="https://img.shields.io/npm/v/create-pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
  <a aria-label="License" href="https://github.com/mfxgu2i/pugkit/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/create-pugkit.svg?style=for-the-badge&labelColor=212121">
  </a>
</p>

## About

[pugkit](https://github.com/mfxgu2i/pugkit)の静的サイト制作環境をセットアップします。

## How To Use

### Interactive

```sh
npm create pugkit@latest
```

### With project name

プロジェクト名を指定して作成します。

```sh
npm create pugkit@latest my-pugkit-project
```

### Current directory

カレントディレクトリに作成します。

```sh
npm create pugkit@latest .
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

pugkit の規約を AI コーディングエージェントに伝える公式の [Agent Skill](https://github.com/agentskills/agentskills) を同梱します。作成したプロジェクトには次の場所へ配置されます。

| ディレクトリ                  | 対応するエージェント |
| ----------------------------- | -------------------- |
| `.claude/skills/pugkit/`      | Claude Code          |
| `.github/skills/pugkit/`      | GitHub Copilot       |

不要な場合はディレクトリごと削除してください。既存のプロジェクトに追加する場合は `npx skills add mfxgu2i/pugkit` を使います。
