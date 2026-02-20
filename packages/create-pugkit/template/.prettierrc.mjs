export default {
  // ========================================
  // 基本設定
  // ========================================

  // 1行の最大文字数
  printWidth: 120,

  // インデント幅
  tabWidth: 2,

  // タブを使用しない（スペース推奨）
  useTabs: false,

  // セミコロンなし
  semi: false,

  // シングルクォート優先
  singleQuote: true,

  // オブジェクトリテラルの括弧内にスペース
  bracketSpacing: true,

  // 末尾カンマなし
  trailingComma: 'none',

  // アロー関数の括弧（必要時のみ）
  arrowParens: 'avoid',

  // 改行コード（LF統一）
  endOfLine: 'lf',

  // ========================================
  // ファイル別設定
  // ========================================

  overrides: [
    // CSS / SCSS（ダブルクォート統一）
    {
      files: '*.{css,scss}',
      options: {
        singleQuote: true,
        printWidth: 120,
        tabWidth: 2
      }
    }
  ]
}
