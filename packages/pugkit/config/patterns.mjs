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
      optimize: [`${srcPath}/**/*.{png,jpg,jpeg}`, `!${srcPath}/**/icons/*`],
      webp: [`${srcPath}/**/*.{png,jpg,jpeg,gif}`, `!${srcPath}/**/icons/*`]
    },
    svg: {
      src: [`${srcPath}/**/*.svg`, `!${srcPath}/**/icons/*`]
    }
  }
}
