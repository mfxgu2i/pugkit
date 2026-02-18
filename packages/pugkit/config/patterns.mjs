export function createGlobPatterns(srcPath) {
  return {
    pug: {
      src: [`${srcPath}/**/[^_]*.pug`, `!${srcPath}/_*/**/*.pug`]
    },
    sass: {
      src: [`${srcPath}/**/[^_]*.scss`, `!${srcPath}/**/_*.scss`]
    },
    script: {
      src: './**/[^_]*.{ts,js}',
      ignore: ['**/*.d.ts', '**/node_modules/**']
    },
    images: {
      optimize: [
        `${srcPath}/**/*.{png,jpg,jpeg}`,
        `!${srcPath}/**/sprites_*/*`,
        `!${srcPath}/**/_inline*/*`,
        `!${srcPath}/**/icons*/*`
      ],
      webp: {
        src: [`${srcPath}/**/*.{png,jpg,jpeg,gif}`],
        ignore: [`!${srcPath}/**/favicons/*`, `!${srcPath}/**/ogp.{png,jpg}`]
      }
    },
    svg: {
      src: [`${srcPath}/**/*.svg`],
      ignore: [`!${srcPath}/**/sprites_*/*`, `!${srcPath}/**/_inline*/*`, `!${srcPath}/**/icons*/*`]
    }
  }
}
