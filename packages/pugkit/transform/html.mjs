import prettier from 'prettier'

export async function formatHtml(html, options = {}) {
  const cleaned = html.replace(/[\u200B-\u200D\uFEFF]/g, '')

  return prettier.format(cleaned, {
    parser: 'html',
    printWidth: options.printWidth || 100_000,
    tabWidth: options.tabWidth || 2,
    useTabs: options.useTabs || false,
    htmlWhitespaceSensitivity: 'ignore',
    singleAttributePerLine: false
  })
}
