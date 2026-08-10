import { mkdtemp, mkdir, writeFile, rm, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { onTestFinished } from 'vitest'
import { createBuilder } from '../../index.mjs'

/**
 * ビルダーを作り、テスト終了時に必ず close() する。
 *
 * 常駐リソース（Sass のコンパイラプロセス・esbuild のビルドコンテキスト）は
 * セッション（BuildContext）単位で持つので、close() しないとテストごとに積み上がる。
 * 実測で、この2ファイルを走らせるだけで常駐プロセスが 4 → 19 に増えた。
 *
 * 素の createBuilder を直接使わずここを通すことで、後始末の書き忘れを構造的に防ぐ。
 */
export async function createTestBuilder(root, mode = 'development') {
  const builder = await createBuilder(root, mode)
  onTestFinished(() => builder.close())
  return builder
}

/**
 * テスト用の一時プロジェクトを作る。
 *
 * すべてのテストがこれを使うことで、リポジトリ内への書き出し・
 * 実在しないパスへの fs 操作・process.cwd() 依存を構造的に防ぐ。
 * onTestFinished で自動的に削除されるため後始末の書き忘れも起きない。
 *
 * @param {Record<string, string>} files ルートからの相対パス -> 内容
 * @param {{ prefix?: string }} options prefix でルート名を変えられる
 *   （「.」始まりのディレクトリに置いたプロジェクトの検証に使う）
 */
export async function createTempProject(files = {}, { prefix = 'pugkit-test-' } = {}) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  onTestFinished(() => rm(root, { recursive: true, force: true }))

  await writeFiles(root, files)

  return {
    root,
    path: (...segments) => resolve(root, ...segments),
    write: filesToWrite => writeFiles(root, filesToWrite),
    read: relativePath => readFile(resolve(root, relativePath), 'utf8'),
    list: relativeDir => listFiles(resolve(root, relativeDir ?? '.'), resolve(root, relativeDir ?? '.'))
  }
}

async function writeFiles(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = resolve(root, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
}

/**
 * ディレクトリ配下のファイルを相対パスの配列で返す（存在しなければ空配列）
 */
export async function listFiles(dir, base = dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const files = []
  for (const entry of entries) {
    const absolutePath = resolve(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath, base)))
    else files.push(absolutePath.slice(base.length + 1))
  }
  return files.sort()
}

/**
 * 最小構成の Pug プロジェクト。ページ・パーシャル・SCSS・JS を1つずつ持つ
 */
export function minimalProjectFiles(overrides = {}) {
  return {
    'package.json': '{"name":"fixture","type":"module"}',
    'pugkit.config.mjs': 'export default {}',
    'src/_partials/_layout.pug':
      'doctype html\nhtml\n  head\n    title= Builder.url.pathname\n  body\n    block content\n',
    'src/index.pug': 'extends /_partials/_layout.pug\nblock content\n  h1 Home\n',
    'src/about.pug': 'extends /_partials/_layout.pug\nblock content\n  h1 About\n',
    'src/assets/css/style.scss': '.a { color: red; .b { color: blue; } }\n',
    'src/assets/js/main.js': 'console.log("hello")\n',
    ...overrides
  }
}
