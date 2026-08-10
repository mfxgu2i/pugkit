import { DEFAULT_OUT_DIR } from '../utils/paths.mjs'

export const defaultConfig = {
  siteUrl: '',
  subdir: '',
  outDir: DEFAULT_OUT_DIR,
  // dev のアセット出力先。null で node_modules/.pugkit/dev
  cacheDir: null,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/',
    domDiff: true
  },
  build: {
    // 画像に関わる設定はここにまとめる。build の直下に並べると、
    // 形式・密度・sharp のオプション・個別上書きが同じ高さに見えて関係が読めない
    image: {
      format: 'webp',
      // src の画像を何倍の原本として扱うか。2 なら等倍版を生成して srcset を出す
      sourceDensity: 2,
      artDirectionSuffix: '_sp',
      options: {
        webp: {
          quality: 80,
          effort: 4,
          smartSubsample: true,
          alphaQuality: 100,
          lossless: false
        },
        jpeg: {
          quality: 75,
          progressive: true,
          mozjpeg: false
        },
        png: {
          quality: 85,
          compressionLevel: 6,
          adaptiveFiltering: true,
          palette: true
        },
        avif: {
          quality: 70,
          lossless: false,
          effort: 4,
          chromaSubsampling: '4:4:4'
        }
      },
      overrides: {}
    },
    // js-beautify の html オプション。上書きは既定のままでは困るものだけに絞る。
    //
    // inline を上書きしないのは、既定を狭めるとインライン要素が改行され、
    // 表示に無い空白が入るため。content_unformatted の textarea も、
    // 外すと中身が整形されて値そのものが変わる
    html: {
      indent_size: 2,
      indent_with_tabs: false,
      max_preserve_newlines: 1,
      preserve_newlines: false,
      end_with_newline: true,
      extra_liners: [],
      wrap_line_length: 0,
      content_unformatted: ['script', 'style', 'pre', 'textarea']
    }
  }
}

/**
 * dev サーバーの待ち受け先を取り出す。
 *
 * 起動前に空きを確かめる側（core/watcher.mjs）と実際に待ち受ける側（core/server.mjs）が
 * 別々に既定値を持つと、確認したポートと待ち受けるポートが食い違いうる。
 * loadConfig を通っていない config（テストや API 利用）でも同じ値になるよう、
 * 既定の当て方ごとここに置く
 */
export function serverAddress(config) {
  return {
    port: config.server?.port ?? defaultConfig.server.port,
    host: config.server?.host ?? defaultConfig.server.host
  }
}
