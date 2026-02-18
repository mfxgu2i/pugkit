/**
 * ロガー
 */

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
}

function formatMessage(symbol, color, label, message) {
  const coloredSymbol = `${color}${symbol}${colors.reset}`
  const coloredLabel = `${color}${label}${colors.reset}`
  return `${coloredSymbol} ${coloredLabel} ${message}`
}

export const logger = {
  info(label, message) {
    console.log(formatMessage('$', colors.cyan, label, message))
  },

  success(label, message) {
    console.log(formatMessage('+', colors.green, label, message))
  },

  warn(label, message) {
    console.log(formatMessage('⚠', colors.yellow, label, message))
  },

  error(label, message) {
    console.error(formatMessage('-', colors.red, label, message))
  },

  skip(label, message) {
    console.log(formatMessage('○', colors.dim, label, message))
  }
}
