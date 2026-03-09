import pkg from 'js-beautify'
const { html: beautifyHtml } = pkg

export function formatHtml(html, options = {}) {
  const cleaned = html.replace(/[\u200B-\u200D\uFEFF]/g, '')
  return beautifyHtml(cleaned, options)
}
