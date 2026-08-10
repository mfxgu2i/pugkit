import { defaultConfig } from './defaults.mjs'

/**
 * 設定ファイルに書かれたキーが実在するかを調べる。
 *
 * 綴りを間違えたキーは既定値のまま素通りする。imageOptimizatoin と書いても
 * ビルドは成功し、全画像が意図しない形式で出力される。例外にならないので、
 * 出力を1枚ずつ確かめない限り気づけない。
 *
 * 有効なキーの一覧は defaultConfig の形から取る。表を別に持つと、
 * 設定項目を増やしたときに片方だけ更新して「正しいのに警告される」ことになる。
 */

/**
 * キーを検査しない場所。中身をそのまま外部ライブラリや利用者の命名に渡すため、
 * pugkit が有効なキーを知らない。`*` は 1 階層分の任意のキーにあたる。
 */
const OPAQUE_PATHS = ['build.html', 'build.image.options.*', 'build.image.overrides']

/**
 * v1 から名前が変わったキー。
 *
 * 値の検証と違って安全側に倒す余地がない。旧キーは既定値のまま無視されるので、
 * 「compress を指定したのに webp で出る」のような食い違いが黙って起きる。
 * 移行先が一意に決まるため、警告ではなく中止して置き換えを促す
 */
export const RENAMED_KEYS = {
  'build.imageOptimization': 'build.image.format',
  'build.imageSourceDensity': 'build.image.sourceDensity',
  'build.imageOptions': 'build.image.options',
  'build.imageOverrides': 'build.image.overrides',
  'build.imageInfo': 'build.image.artDirectionSuffix'
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function matchesPattern(pattern, path) {
  const patternSegments = pattern.split('.')
  const pathSegments = path.split('.')

  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every((segment, i) => segment === '*' || segment === pathSegments[i])
}

const isOpaque = path => OPAQUE_PATHS.some(pattern => matchesPattern(pattern, path))

function collect(user, defaults, prefix, found) {
  for (const key of Object.keys(user)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (RENAMED_KEYS[path]) {
      found.renamed.push(path)
      continue
    }

    if (!(key in defaults)) {
      found.unknown.push(path)
      continue
    }

    // 知らないキーの中はもう検査できない。ここで降りるのをやめる
    if (isOpaque(path)) continue

    if (isPlainObject(defaults[key]) && isPlainObject(user[key])) {
      collect(user[key], defaults[key], path, found)
    }
  }
}

/**
 * 利用者の設定を既定値の形と突き合わせ、実在しないキーと旧名のキーを集める。
 *
 * @param userConfig pugkit.config.mjs の default export
 * @returns {{ unknown: string[], renamed: string[] }} ドット区切りのパス
 */
export function inspectConfigKeys(userConfig) {
  const found = { unknown: [], renamed: [] }
  if (isPlainObject(userConfig)) collect(userConfig, defaultConfig, '', found)
  return found
}
