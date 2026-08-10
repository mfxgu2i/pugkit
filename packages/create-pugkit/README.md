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

[mise](https://mise.jdx.dev/) を使わない場合は `mise install` を飛ばしてください。Node 22 以上であれば動きます。

## Agent Skill

pugkit の規約を AI コーディングエージェントに伝える公式の [Agent Skill](https://github.com/agentskills/agentskills) を同梱します。作成したプロジェクトには次の場所へ配置されます。

| ディレクトリ                  | 対応するエージェント |
| ----------------------------- | -------------------- |
| `.claude/skills/pugkit/`      | Claude Code          |
| `.github/skills/pugkit/`      | GitHub Copilot       |

不要な場合はディレクトリごと削除してください。既存のプロジェクトに追加する場合は `npx skills add mfxgu2i/pugkit` を使います。
