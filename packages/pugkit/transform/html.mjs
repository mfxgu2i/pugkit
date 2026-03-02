import pkg from 'js-beautify'
const { html: beautifyHtml } = pkg

export function formatHtml(html, options = {}) {
  const cleaned = html.replace(/[\u200B-\u200D\uFEFF]/g, '')

  return beautifyHtml(cleaned, {
    indent_size: options.tabWidth || 2,
    indent_with_tabs: options.useTabs || false,
    max_preserve_newlines: 1,
    preserve_newlines: false,
    end_with_newline: true,
    extra_liners: [],
    wrap_line_length: 0,
    inline: [],
    content_unformatted: ['script', 'style', 'pre']
  })
}
