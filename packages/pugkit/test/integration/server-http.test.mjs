import { describe, expect, it, onTestFinished } from 'vitest'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createBuilder } from '../../index.mjs'
import { createTempProject, minimalProjectFiles } from '../helpers/project.mjs'

/**
 * dev サーバーを実際に listen させて HTTP 越しに確認する。
 * ルーティング・エラーページ・morph 可否ヘッダー・SSE はここでしか守れない。
 *
 * ポートは 0 を指定して OS に割り当てさせるため、並列実行でも衝突しない。
 */
async function startDevServer(files = minimalProjectFiles()) {
  const project = await createTempProject(files)
  const builder = await createBuilder(project.root, 'development')
  const { context } = builder

  context.config.server.port = 0
  await builder.tasks.server(context)

  const { port } = context.server
  onTestFinished(() => context.server.close())

  return {
    project,
    context,
    get: (path, options) => fetch(`http://localhost:${port}${path}`, options)
  }
}

describe('dev サーバーの配信', () => {
  it('Pug ページをリクエスト時にビルドして返す', async () => {
    const server = await startDevServer()
    const res = await server.get('/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    await expect(res.text()).resolves.toContain('<h1>Home</h1>')
  })

  it('ライブリロードスクリプトを注入する', async () => {
    const server = await startDevServer()
    const html = await (await server.get('/')).text()

    expect(html).toContain('__pugkit_sse')
  })

  it('存在しないページは 404 を返す', async () => {
    const server = await startDevServer()
    expect((await server.get('/nope.html')).status).toBe(404)
  })

  it('パーシャルはページとして配信しない', async () => {
    const server = await startDevServer()
    expect((await server.get('/_partials/_layout.html')).status).toBe(404)
  })

  it('壊れた URL エンコードは 400 を返す', async () => {
    const server = await startDevServer()
    expect((await server.get('/%')).status).toBe(400)
  })

  it('クエリ文字列があってもページを解決できる', async () => {
    const server = await startDevServer()
    expect((await server.get('/?preview=1')).status).toBe(200)
  })
})

describe('DOM 差分適用の可否判定', () => {
  // クライアントはこのヘッダーを見て「body の差分適用で足りるか」を決める
  it('初回は差分適用できない（比較対象が無い）', async () => {
    const server = await startDevServer()
    const res = await server.get('/')

    expect(res.headers.get('x-pugkit-morphable')).toBe('0')
  })

  it('head も script も変わっていなければ差分適用できる', async () => {
    const server = await startDevServer()
    await server.get('/')
    const res = await server.get('/')

    expect(res.headers.get('x-pugkit-morphable')).toBe('1')
  })

  it('head が変わったら差分適用させない', async () => {
    const server = await startDevServer()
    await server.get('/')
    await server.get('/')

    await server.project.write({
      'src/_partials/_layout.pug':
        'doctype html\nhtml\n  head\n    title Changed\n    meta(name="description" content="new")\n  body\n    block content\n'
    })
    server.context.cache.clearPageHtml()
    server.context.cache.invalidatePugTemplate(server.project.path('src/index.pug'))

    const res = await server.get('/')
    expect(res.headers.get('x-pugkit-morphable')).toBe('0')
  })
})

describe('ビルドエラー', () => {
  it('エラーページを 500 で返し、サーバーは動き続ける', async () => {
    const server = await startDevServer({
      ...minimalProjectFiles(),
      'src/broken.pug': 'extends /_partials/_missing.pug\n'
    })

    const res = await server.get('/broken.html')
    expect(res.status).toBe(500)
    await expect(res.text()).resolves.toContain('Pug Build Error')

    // 他のページは通常どおり配信される
    expect((await server.get('/')).status).toBe(200)
  })

  it('エラーページにもライブリロードを仕込んで自動復帰できるようにする', async () => {
    const server = await startDevServer({
      ...minimalProjectFiles(),
      'src/broken.pug': 'extends /_partials/_missing.pug\n'
    })

    const html = await (await server.get('/broken.html')).text()
    expect(html).toContain('__pugkit_sse')
  })
})

describe('build の出力先', () => {
  /**
   * dev が配信するのは src から導かれるものだけ。
   * build の出力先を覗きに行くと、src から消したページが「復活」して見えたり、
   * 前回ビルドの成果物が現在のソースの代わりに表示されたりする。
   * outDir にしか無いファイルは public/ に置けば dev でも build でも同じに扱える。
   */
  // 出力先の有無はサーバー起動時に判定されるので、起動前に用意しておく
  const withLegacyOutput = clean => ({
    ...minimalProjectFiles(),
    'pugkit.config.mjs': `export default { build: { clean: ${clean} } }\n`,
    'dist/legacy.html': '<html><body>LEGACY</body></html>\n',
    'dist/legacy.css': 'body{}\n'
  })

  it.each([[true], [false]])('clean: %s でも配信しない', async clean => {
    const server = await startDevServer(withLegacyOutput(clean))

    expect((await server.get('/legacy.html')).status).toBe(404)
    expect((await server.get('/legacy.css')).status).toBe(404)
  })
})

describe('配信できないアセット', () => {
  /**
   * 静的配信は存在を確認してから読み出すので、その間にファイルが消えると失敗する。
   * dev では watcher の削除・キャッシュ作り直しと配信が競合するため必ず起きる。
   * 応答が壊れるのは許容するが、dev サーバーが落ちてはいけない
   * （落ちるとエラーページも自動復帰も無く、原因も編集したファイルに見えない）。
   *
   * 読み取り権限を落としたファイルで、消失と同じ「存在するのに読めない」を作る。
   */
  it('読み出しに失敗してもサーバーは動き続ける', async () => {
    const server = await startDevServer()
    const unreadable = `${server.context.paths.outputRoot}/assets/css/style.css`
    await mkdir(dirname(unreadable), { recursive: true })
    await writeFile(unreadable, 'body{}')
    await chmod(unreadable, 0o000)
    onTestFinished(() => chmod(unreadable, 0o644))

    await server.get('/assets/css/style.css').catch(() => null)

    expect((await server.get('/')).status).toBe(200)
  })
})

describe('SSE', () => {
  it('リロード通知を種類つきで送る', async () => {
    const server = await startDevServer()
    const res = await server.get('/__pugkit_sse')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    // 接続直後の retry 行
    await reader.read()

    server.context.server.reload('html')
    const { value } = await reader.read()

    expect(decoder.decode(value)).toBe('event: reload\ndata: html\n\n')
    await reader.cancel()
  })

  it('CSS 更新はリロードとは別のイベントで送る', async () => {
    const server = await startDevServer()
    const res = await server.get('/__pugkit_sse')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    await reader.read()

    server.context.server.reloadCSS()
    const { value } = await reader.read()

    expect(decoder.decode(value)).toContain('event: css-update')
    await reader.cancel()
  })
})
