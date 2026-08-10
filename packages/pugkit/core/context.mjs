import { resolve } from 'node:path'
import { assertSafeToWipe } from '../utils/safe-dir.mjs'
import { normalizeSubdir } from '../utils/subdir.mjs'
import { DEFAULT_OUT_DIR, resolveFromRoot } from '../utils/paths.mjs'
import { existsSync } from 'node:fs'
import { CacheManager } from './cache.mjs'
import { DependencyGraph } from './graph.mjs'
import { ImageWidthRequests } from './image-widths.mjs'
import { ResourceStore } from './resources.mjs'
import { logger } from '../utils/logger.mjs'

/**
 * dev の出力先は起動のたびに中身を作り直すため、消してはいけない場所を弾く。
 * 実際の削除時には目印ファイルによる二段目の確認も行う（utils/file.mjs の resetDevCache）。
 */
function assertSafeDevOutDir(dir, root, buildOutDir) {
  // 配下を禁じる対象。プロジェクトルート配下は既定値もそうなので許可する
  const keepOut = [
    [resolve(root, 'src'), 'src'],
    [resolve(root, 'public'), 'public'],
    [buildOutDir, 'outDir（build の出力先）']
  ]

  assertSafeToWipe(dir, {
    label: 'cacheDir',
    protect: [[root, 'プロジェクトルート'], ...keepOut],
    keepOut,
    keepOutReason: 'dev の生成物が混ざります'
  })
}

/**
 * dev のアセット出力先を解決する。
 * build の成果物と混ざらないよう outDir とは別のキャッシュディレクトリを使う。
 * 既定は node_modules 配下（gitignore 済みのため追加設定が不要）。
 */
function resolveDevOutDir(config, buildOutDir) {
  if (config.cacheDir) {
    const dir = resolveFromRoot(config.root, config.cacheDir)
    assertSafeDevOutDir(dir, config.root, buildOutDir)
    return dir
  }

  // node_modules が無い環境で node_modules/ を作らないよう、存在するときだけそこを使う
  const base = existsSync(resolve(config.root, 'node_modules'))
    ? resolve(config.root, 'node_modules/.pugkit')
    : resolve(config.root, '.pugkit')

  return resolve(base, 'dev')
}

export class BuildContext {
  constructor(config, mode) {
    this.config = config
    this.mode = mode
    this.cache = new CacheManager(mode)
    this.graph = new DependencyGraph()
    this.sassGraph = new DependencyGraph()
    this.scriptGraph = new DependencyGraph()
    this.imageGraph = new DependencyGraph() // Pug -> 画像ファイルの依存グラフ（dev時に構築）
    // imageInfo() が要求した幅。build では pug が先に走るので image タスクが読める
    this.imageWidths = new ImageWidthRequests()
    // Sass / esbuild の常駐リソース。Builder.close() で破棄する
    this.resources = new ResourceStore()
    // warnOnce で出し終えた理由
    this.warnedReasons = new Set()

    const buildOutDir = resolveFromRoot(config.root, config.outDir ?? DEFAULT_OUT_DIR)

    // dev は outDir に一切書かず、読みもしない。「outDir にあるもの = build の成果物」を
    // 保つことで、dev のソースマップ等が本番成果物に混ざらない
    const isDevelopment = mode === 'development'
    const resolvedOutDir = isDevelopment ? resolveDevOutDir(config, buildOutDir) : buildOutDir

    const subdir = normalizeSubdir(config.subdir)

    this.paths = {
      root: config.root,
      src: resolve(config.root, 'src'),
      public: resolve(config.root, 'public'),
      // このモードでの書き込みルート。dev では cacheDir を指すので「dist」ではない
      outputRoot: resolvedOutDir,
      // subdir を含めた実際の書き込み先。タスクはここに書く
      output: subdir ? resolve(resolvedOutDir, subdir) : resolvedOutDir
    }

    this.server = null
  }

  /**
   * 同じ理由の警告をセッション中に1回だけ出す。
   *
   * ページごとに判定するものは、共通レイアウト由来だとページ数だけ警告が並ぶ。
   * 数が多いと他のログを押し流して、かえって読まれなくなる
   *
   * @param reason 出し分けの鍵。文言ではなく理由そのものを渡す
   */
  warnOnce(scope, reason, message) {
    if (this.warnedReasons.has(reason)) return

    this.warnedReasons.add(reason)
    logger.warn(scope, message)
  }

  get isProduction() {
    return this.mode === 'production'
  }

  get isDevelopment() {
    return this.mode === 'development'
  }
}
