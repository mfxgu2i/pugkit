import { resolve, isAbsolute, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { CacheManager } from './cache.mjs'
import { DependencyGraph } from './graph.mjs'

/**
 * dev の出力先は起動のたびに中身を作り直すため、消してはいけない場所を弾く。
 * 実際の削除時には目印ファイルによる二段目の確認も行う（utils/file.mjs の resetDevCache）。
 */
function assertSafeDevOutDir(dir, config) {
  const root = config.root
  const outDir = config.outDir ?? 'dist'
  const contains = (parent, child) => {
    const rel = relative(parent, child)
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  }

  // dir がこれらを内包すると、起動時の削除で巻き込んで消してしまう
  const mustNotContain = [
    [root, 'プロジェクトルート'],
    [resolve(root, 'src'), 'src'],
    [resolve(root, 'public'), 'public'],
    [isAbsolute(outDir) ? outDir : resolve(root, outDir), 'outDir（build の出力先）']
  ]

  for (const [target, label] of mustNotContain) {
    if (contains(dir, target)) {
      throw new Error(`cacheDir に${label}を含むパスは指定できません。dev サーバー起動時に中身が削除されます: ${dir}`)
    }
  }

  // これらの配下に置くと dev の生成物が src や build 成果物に混ざる
  // （プロジェクトルート配下は既定値もそうなので許可する）
  const mustNotBeInside = [
    [resolve(root, 'src'), 'src'],
    [resolve(root, 'public'), 'public'],
    [isAbsolute(outDir) ? outDir : resolve(root, outDir), 'outDir（build の出力先）']
  ]

  for (const [target, label] of mustNotBeInside) {
    if (contains(target, dir)) {
      throw new Error(`cacheDir に${label}の配下は指定できません。dev の生成物が混ざります: ${dir}`)
    }
  }
}

/**
 * dev のアセット出力先を解決する。
 * build の成果物と混ざらないよう outDir とは別のキャッシュディレクトリを使う。
 * 既定は node_modules 配下（gitignore 済みのため追加設定が不要）。
 */
function resolveDevOutDir(config) {
  if (config.cacheDir) {
    const dir = isAbsolute(config.cacheDir) ? config.cacheDir : resolve(config.root, config.cacheDir)
    assertSafeDevOutDir(dir, config)
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

    const outDir = config.outDir ?? 'dist'
    const buildOutDir = isAbsolute(outDir) ? outDir : resolve(config.root, outDir)

    // dev は outDir に一切書かず、読みもしない。「outDir にあるもの = build の成果物」を
    // 保つことで、dev のソースマップ等が本番成果物に混ざらない
    const isDevelopment = mode === 'development'
    const resolvedOutDir = isDevelopment ? resolveDevOutDir(config) : buildOutDir

    // 先頭スラッシュが残っていると resolve() が絶対パス扱いし、出力先が outDir の外に出る
    const subdir = String(config.subdir ?? '').replace(/^[/\\]+|[/\\]+$/g, '')

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



  get isProduction() {
    return this.mode === 'production'
  }

  get isDevelopment() {
    return this.mode === 'development'
  }
}
