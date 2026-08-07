import { describe, expect, it, onTestFinished } from 'vitest'
import { createBuilder } from '../../index.mjs'
import { FileWatcher } from '../../core/watcher.mjs'
import { createTempProject, listFiles, minimalProjectFiles } from '../helpers/project.mjs'
import { DEV_CACHE_MARKER } from '../../utils/file.mjs'

/**
 * dev 起動時の初期化。
 * 「どのディレクトリを作り直すか」「何を先に生成しておくか」の結線を固定する。
 * 引数の取り違えは削除対象を変えてしまうため、単体の resetDevCache だけでは守れない。
 */
/** 本番と同じく Builder 経由でタスクを実行する口を渡す */
const runTaskOf = builder => (name, options) => builder.runTask(name, options)

async function startWatcher(files = minimalProjectFiles()) {
  const project = await createTempProject({
    ...files,
    'public/robots.txt': 'User-agent: *\n',
    'src/assets/icons/arrow.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>\n'
  })
  const builder = await createBuilder(project.root, 'development')
  // start() はキャッシュを消す前にポートの空きを確認する。
  // 0 なら OS 割り当てになるので、並列実行しても既定ポートを取り合わない
  builder.context.config.server.port = 0
  const watcher = new FileWatcher(builder.context, runTaskOf(builder))

  await watcher.start()
  onTestFinished(() => watcher.stop())

  return { project, context: builder.context, watcher, runTask: runTaskOf(builder) }
}

describe('dev サーバーの起動', () => {
  it('dev キャッシュを作り直して目印を残す', async () => {
    const { context } = await startWatcher()

    expect(await listFiles(context.paths.outDir)).toContain(DEV_CACHE_MARKER)
  })

  it('前回セッションの残骸を配信しない', async () => {
    const project = await createTempProject(minimalProjectFiles())
    // 1回目のセッションが作った古い生成物
    const builder1 = await createBuilder(project.root, 'development')
    builder1.context.config.server.port = 0
    const watcher1 = new FileWatcher(builder1.context, runTaskOf(builder1))
    await watcher1.start()
    await watcher1.stop()
    await project.write({ [`${builder1.context.paths.outDir}/stale.css`]: 'body{}' })

    const builder2 = await createBuilder(project.root, 'development')
    builder2.context.config.server.port = 0
    const watcher2 = new FileWatcher(builder2.context, runTaskOf(builder2))
    await watcher2.start()
    onTestFinished(() => watcher2.stop())

    expect(await listFiles(builder2.context.paths.outDir)).not.toContain('stale.css')
  })

  it('build の出力先には触れない', async () => {
    const { project } = await startWatcher()

    expect(await listFiles(project.path('dist'))).toEqual([])
  })

  it('HTML 以外のアセットを起動時に用意する（出力先が空でも表示できるように）', async () => {
    const { context } = await startWatcher()
    const output = await listFiles(context.paths.outDir)

    expect(output).toContain('assets/css/style.css')
    expect(output).toContain('assets/js/main.js')
    expect(output).toContain('assets/icons.svg') // スプライト
    expect(output).toContain('robots.txt') // public のコピー
  })

  it('HTML は事前生成しない（リクエスト時ビルド + メモリ配信のため）', async () => {
    const { context } = await startWatcher()

    expect((await listFiles(context.paths.outDir)).filter(f => f.endsWith('.html'))).toEqual([])
  })

  it('dev の CSS は非圧縮でソースマップつき', async () => {
    const { context } = await startWatcher()
    const output = await listFiles(context.paths.outDir)

    expect(output).toContain('assets/css/style.css.map')
    const css = await import('node:fs/promises').then(fs =>
      fs.readFile(`${context.paths.outDir}/assets/css/style.css`, 'utf8')
    )
    expect(css).toMatch(/\n/) // minify されていれば1行になる
  })
})

describe('dev の差分ビルド', () => {
  // 「作り直されたか」は出力ファイルの mtime で観測する。
  // 内容の一致だけ見ると、全ビルドに退行しても気づけない
  const mtimeOf = async (context, name) =>
    (await import('node:fs/promises').then(f => f.stat(`${context.paths.outDir}/${name}`))).mtimeMs

  const multiEntryProject = () =>
    minimalProjectFiles({
      'src/assets/css/_vars.scss': '$c: red;\n',
      'src/assets/css/style.scss': "@use 'vars';\n.a { color: vars.$c; }\n",
      'src/assets/css/other.scss': '.b { color: blue; }\n'
    })

  it('Sass のパーシャル変更では依存するエントリだけ作り直す', async () => {
    const { project, context, runTask } = await startWatcher(multiEntryProject())
    const read = name => import('node:fs/promises').then(f => f.readFile(`${context.paths.outDir}/${name}`, 'utf8'))
    const otherBefore = await mtimeOf(context, 'assets/css/other.css')

    await new Promise(r => setTimeout(r, 10)) // mtime の解像度を確保する
    await project.write({ 'src/assets/css/_vars.scss': '$c: green;\n' })
    await runTask('sass', { files: [project.path('src/assets/css/_vars.scss')] })

    expect(await read('assets/css/style.css')).toContain('green')
    // 依存していないエントリは触られない
    expect(await mtimeOf(context, 'assets/css/other.css')).toBe(otherBefore)
  })

  it('Sass のエントリ変更では他のエントリを作り直さない', async () => {
    const { project, context, runTask } = await startWatcher(multiEntryProject())
    const read = name => import('node:fs/promises').then(f => f.readFile(`${context.paths.outDir}/${name}`, 'utf8'))
    const otherBefore = await mtimeOf(context, 'assets/css/other.css')

    await new Promise(r => setTimeout(r, 10))
    await project.write({ 'src/assets/css/style.scss': '.a { color: rebeccapurple; }\n' })
    await runTask('sass', { files: [project.path('src/assets/css/style.scss')] })

    expect(await read('assets/css/style.css')).toContain('rebeccapurple')
    expect(await mtimeOf(context, 'assets/css/other.css')).toBe(otherBefore)
  })

  it('JS の変更を出力に反映する', async () => {
    const { project, context, runTask } = await startWatcher()

    await project.write({ 'src/assets/js/main.js': 'console.log("updated")\n' })
    await runTask('script', { files: [project.path('src/assets/js/main.js')] })

    const js = await import('node:fs/promises').then(f =>
      f.readFile(`${context.paths.outDir}/assets/js/main.js`, 'utf8')
    )
    expect(js).toContain('updated')
  })

  it('dev の JS は console を残す', async () => {
    const { context } = await startWatcher()

    const js = await import('node:fs/promises').then(f =>
      f.readFile(`${context.paths.outDir}/assets/js/main.js`, 'utf8')
    )
    expect(js).toContain('console.log')
  })
})
