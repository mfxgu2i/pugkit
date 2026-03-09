export const defaultConfig = {
  siteUrl: '',
  subdir: '',
  outDir: 'dist',
  debug: false,
  server: {
    port: 5555,
    host: 'localhost',
    startPath: '/'
  },
  build: {
    clean: true,
    imageOptimization: 'webp',
    imageInfo: {
      artDirectionSuffix: '_sp'
    },
    imageOverrides: {},
    html: {
      indent_size: 2,
      indent_with_tabs: false,
      max_preserve_newlines: 1,
      preserve_newlines: false,
      end_with_newline: true,
      extra_liners: [],
      wrap_line_length: 0,
      inline: [],
      content_unformatted: ['script', 'style', 'pre']
    },
    imageOptions: {
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
    }
  },
  benchmark: {
    image: {
      threshold: '300KB',
      qualityMin: 40,
      qualityMax: 90,
      qualityStep: 10
    }
  }
}
