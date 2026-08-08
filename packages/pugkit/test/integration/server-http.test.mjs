import { describe, expect, it, onTestFinished } from 'vitest'
import net from 'node:net'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
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
    builder,
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
  /**
   * body の差分適用では <head>・<html> 属性・<script> の変更を反映できないため、
   * それらが変わっていないかを指紋で判定する。
   *
   * 指紋は「そのタブが今表示している HTML」の性質なので HTML に埋め込んで持たせる。
   * サーバーが「直近に返した指紋」を1つだけ覚える作りだと、同じページを複数タブで
   * 開いたとき2つ目以降が「変わっていない」と誤判定し、head と script を取りこぼす。
   */
  const signatureOf = html => html.match(/data-pugkit-signature="([^"]+)"/)?.[1]

  const changeHead = async server => {
    await server.project.write({
      'src/_partials/_layout.pug':
        'doctype html\nhtml\n  head\n    title Changed\n    meta(name="description" content="new")\n  body\n    block content\n'
    })
    server.context.cache.clearPageHtml()
    server.context.cache.invalidatePugTemplate(server.project.path('src/index.pug'))
  }

  it('配信する HTML に指紋を埋め込む', async () => {
    const server = await startDevServer()

    expect(signatureOf(await (await server.get('/')).text())).toMatch(/^[0-9a-f]+$/)
  })

  it('内容が同じなら同じ指紋になる（差分適用してよい）', async () => {
    const server = await startDevServer()

    const first = signatureOf(await (await server.get('/')).text())
    const second = signatureOf(await (await server.get('/')).text())

    expect(second).toBe(first)
  })

  it('head が変わったら指紋も変わる（差分適用させない）', async () => {
    const server = await startDevServer()
    const before = signatureOf(await (await server.get('/')).text())

    await changeHead(server)

    expect(signatureOf(await (await server.get('/')).text())).not.toBe(before)
  })

  it('何度取得しても、変更前の指紋と変更後の指紋は食い違ったまま', async () => {
    // 複数タブ: 1つ目が取得しても、2つ目が持っている古い指紋は新しい HTML と一致しない
    const server = await startDevServer()
    const tabA = signatureOf(await (await server.get('/')).text())
    const tabB = signatureOf(await (await server.get('/')).text())
    expect(tabB).toBe(tabA)

    await changeHead(server)

    const fetchedByTabA = signatureOf(await (await server.get('/')).text())
    const fetchedByTabB = signatureOf(await (await server.get('/')).text())

    expect(fetchedByTabA).not.toBe(tabA)
    expect(fetchedByTabB).not.toBe(tabB)
  })

  it('ページごとに指紋が異なる', async () => {
    const server = await startDevServer()

    const home = signatureOf(await (await server.get('/')).text())
    const about = signatureOf(await (await server.get('/about.html')).text())

    expect(about).not.toBe(home)
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

describe('配信ルートの封じ込め', () => {
  /**
   * fetch は "/.." を送る前に正規化してしまうので、生のソケットで送る。
   * Pug の解決（resolvePugSource）側にはテストがあるが、
   * 既存 HTML を読み出す経路にも同じ封じ込めが要る。
   */
  function rawGet(port, rawPath) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, 'localhost', () => {
        socket.write(`GET ${rawPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`)
      })
      let data = ''
      socket.setEncoding('utf8')
      socket.on('data', chunk => (data += chunk))
      socket.on('end', () => resolve(data))
      socket.on('error', reject)
    })
  }

  /**
   * 「..」の数は配信ルートの深さで決まる。固定で書くと届かないパスになり、
   * 封じ込めを外しても素通りするテスト（＝何も守らないテスト）になる
   */
  const escapeTo = (server, target) => relative(server.context.paths.outputRoot, server.project.path(target))

  const shapes = {
    そのまま: escape => `/${escape}`,
    スラッシュ重複: escape => `/${escape.replace(/\//g, '//')}`,
    エンコード: escape => `/${escape.replace(/\//g, '%2f')}`,
    'カレント経由': escape => `/./${escape}`
  }

  it.each(Object.keys(shapes))('%s の形でも配信ルートの外を読み出せない', async shape => {
    const server = await startDevServer({
      ...minimalProjectFiles(),
      // 配信ルート（dev キャッシュ）の外に置いた、公開してはいけないファイル
      'secret.html': '<html><body>SECRET</body></html>\n'
    })
    const rawPath = shapes[shape](escapeTo(server, 'secret.html'))

    const response = await rawGet(server.context.server.port, rawPath)

    // 届くはずのパスであることを確かめてから、届いていないことを確かめる
    expect(rawPath).toMatch(/\.\.|%2e/)
    expect(response).not.toContain('SECRET')
  })

  it('配信ルートの中の HTML は読み出せる（封じ込めが強すぎないことの確認）', async () => {
    const server = await startDevServer({ ...minimalProjectFiles(), 'public/legacy.html': '<html>OK</html>\n' })
    await server.builder.runTask('copy')

    expect((await server.get('/legacy.html')).status).toBe(200)
  })
})

describe('Pug 由来でない HTML', () => {
  // public に置いた既存 HTML も dev で編集される。ライブリロードが効かないと、
  // そのページだけ手動リロードが必要という分かりにくい状態になる
  it('ライブリロードを注入する', async () => {
    const server = await startDevServer({ ...minimalProjectFiles(), 'public/legacy.html': '<html>OK</html>\n' })
    await server.builder.runTask('copy')

    const html = await (await server.get('/legacy.html')).text()

    expect(html).toContain('data-pugkit-live-reload')
    expect(html).toContain('__pugkit_sse')
  })

  // 中身の作られ方を pugkit が知らないので、差分適用はさせずフルリロードにする
  it('指紋は埋め込まない（差分適用の対象外）', async () => {
    const server = await startDevServer({ ...minimalProjectFiles(), 'public/legacy.html': '<html>OK</html>\n' })
    await server.builder.runTask('copy')

    const html = await (await server.get('/legacy.html')).text()
    // 開始タグだけを見る。スクリプト本体には属性名が文字列として現れる
    const openingTag = html.match(/<script data-pugkit-live-reload[^>]*>/)?.[0]

    expect(openingTag).toBeDefined()
    expect(openingTag).not.toContain('data-pugkit-signature')
  })
})

describe('URL の解決順', () => {
  /**
   * 同じ URL 形に対して、Pug ページ・public 由来の HTML・sirv の静的配信で
   * 解決順が食い違ってはいけない。「dev で見えるものと本番で見えるものが違う」
   * という形の事故になる。
   *
   * 基準は sirv の解決順（フラットファイル優先。末尾スラッシュは除去して同順）。
   * resolvePugSource もこれに合わせてある。
   */
  const bothShapes = () => ({
    ...minimalProjectFiles(),
    'public/dir.html': '<html><body>FLAT</body></html>\n',
    'public/dir/index.html': '<html><body>DIRINDEX</body></html>\n',
    'src/page.pug': 'doctype html\nhtml\n  body\n    p PUG-FLAT\n',
    'src/page/index.pug': 'doctype html\nhtml\n  body\n    p PUG-DIRINDEX\n'
  })

  const startWithPublic = async () => {
    const server = await startDevServer(bothShapes())
    await server.builder.runTask('copy')
    return server
  }

  const bodyOf = async (server, url) => (await (await server.get(url)).text()).match(/FLAT|DIRINDEX|PUG-[A-Z]+/)?.[0]

  it.each([['/dir'], ['/dir/']])('%s はフラットファイルを優先する', async url => {
    const server = await startWithPublic()

    expect(await bodyOf(server, url)).toBe('FLAT')
  })

  it('拡張子つきで指定すればそのファイルを返す', async () => {
    const server = await startWithPublic()

    expect(await bodyOf(server, '/dir.html')).toBe('FLAT')
  })

  it('Pug ページと非Pug HTML で解決順が一致する', async () => {
    const server = await startWithPublic()

    // どちらも「ディレクトリの index」ではなく「フラットなファイル」を選ぶ
    expect(await bodyOf(server, '/page')).toBe('PUG-FLAT')
    expect(await bodyOf(server, '/dir')).toBe('FLAT')
  })
})

describe('build の出力先', () => {
  /**
   * dev が配信するのは src から導かれるものだけ。
   * build の出力先を覗きに行くと、src から消したページが「復活」して見えたり、
   * 前回ビルドの成果物が現在のソースの代わりに表示されたりする。
   * outDir にしか無いファイルは public/ に置けば dev でも build でも同じに扱える。
   */
  it('outDir にしか無いファイルは配信しない', async () => {
    const server = await startDevServer({
      ...minimalProjectFiles(),
      'dist/legacy.html': '<html><body>LEGACY</body></html>\n',
      'dist/legacy.css': 'body{}\n'
    })

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

  /**
   * 切断されたクライアントを持ち続けると、リロードのたびに死んだ接続へ書き込む。
   * 次の broadcast で結果的に取り除かれるので気づきにくいが、
   * タブを開き閉じするたびに溜まる
   */
  it('切断されたクライアントを持ち続けない', async () => {
    const server = await startDevServer()
    const controller = new AbortController()
    const res = await server.get('/__pugkit_sse', { signal: controller.signal })
    res.body.getReader().read()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(server.context.server.clientCount).toBe(1)

    controller.abort()
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(server.context.server.clientCount).toBe(0)
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
