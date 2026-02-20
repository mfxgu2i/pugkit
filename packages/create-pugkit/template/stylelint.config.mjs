/**
 * Stylelint Configuration
 * モダンなCSS/SCSSのための厳格なリントルール設定
 *
 * @see https://stylelint.io/user-guide/configure
 */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-recess-order'],

  ignoreFiles: [
    '**/*.js',
    '**/*.ts',
    '**/*.html',
    '**/*.pug',
    '**/*.json',
    '**/*.md',
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ],

  rules: {
    // ========================================
    // @ ルール
    // ========================================

    /**
     * @font-faceで必須プロパティを強制
     * font-familyとsrcは必須
     */
    'at-rule-property-required-list': {
      'font-face': ['font-family', 'src']
    },

    // ========================================
    // カラー
    // ========================================

    /**
     * 16進数カラーコードのアルファ値を禁止
     * 理由: oklch()などのモダンなカラー関数を推奨
     * NG: #ffffff80
     * OK: oklch(from #fff l c h / 0.5)
     */
    'color-hex-alpha': 'never',

    /**
     * 名前付きカラーを禁止
     * 理由: 一貫性のため16進数またはoklch()を使用
     * NG: color: red;
     * OK: color: #ff0000; または oklch(...)
     */
    'color-named': [
      'never',
      {
        message: '名前付きカラー（red, blue等）は禁止です。16進数（#ff0000）またはoklch()を使用してください'
      }
    ],

    /**
     * 無効な16進数カラーコードを禁止
     */
    'color-no-invalid-hex': true,

    /**
     * モダンなカラー関数記法を強制
     * 理由: oklch(), lab()などのCSS Color Module Level 4を推奨
     * NG: rgb(255, 0, 0)
     * OK: oklch(0.628 0.258 29.23)
     */
    'color-function-notation': [
      'modern',
      {
        message: '古い形式のカラー関数（rgb(255, 0, 0)）ではなく、モダンな形式（oklch(...)）を使用してください'
      }
    ],

    /**
     * 色相角度の単位を明示
     * 理由: oklch()使用時の可読性向上
     * OK: oklch(0% 0 0deg / 0.3)
     */
    'hue-degree-notation': 'angle',

    /**
     * アルファ値を数値形式で統一
     * 理由: プロジェクトでは0.5形式を100%使用
     * NG: oklch(... / 50%)
     * OK: oklch(... / 0.5)
     */
    'alpha-value-notation': [
      'number',
      {
        message: 'アルファ値はパーセント（50%）ではなく数値（0.5）で指定してください'
      }
    ],

    // ========================================
    // ネスト・セレクタ
    // ========================================

    /**
     * ネストの深さを3階層までに制限
     * 理由: プロジェクトの実態（最大3階層）に合わせた設定
     * BEM構造を採用しているため、深いネストは不要
     */
    'max-nesting-depth': [
      3,
      {
        ignore: ['blockless-at-rules', 'pseudo-classes'],
        message: 'ネストの深さは3階層までです。BEM構造を見直してください'
      }
    ],

    /**
     * タイプセレクタによる修飾を禁止
     * 理由: 詳細度の肥大化を防ぐ
     * NG: div.class, a#id
     * OK: .class, .class[data-attr]
     */
    'selector-no-qualifying-type': [
      true,
      {
        ignore: ['attribute', 'class'],
        message: 'タグ名でクラスやIDを修飾しないでください（例: div.class → .class）'
      }
    ],

    /**
     * IDセレクタを完全禁止
     * 理由: モダンなCSS設計（BEM）ではIDセレクタを使用しない
     */
    'selector-max-id': [
      0,
      {
        message: 'IDセレクタ（#id）は使用できません。クラスセレクタ（.class）を使用してください'
      }
    ],

    /**
     * ユニバーサルセレクタの使用を制限
     * 理由: パフォーマンス上の問題を防ぐ
     * OK: .class + *（隣接セレクタ後は許可）
     */
    'selector-max-universal': [
      1,
      {
        ignoreAfterCombinators: ['+']
      }
    ],

    /**
     * 疑似要素にダブルコロン記法を強制
     * 理由: 疑似クラスとの区別を明確に
     * NG: :before
     * OK: ::before
     */
    'selector-pseudo-element-colon-notation': 'double',

    /**
     * 未知の疑似要素を禁止（例外あり）
     */
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['scroll-button']
      }
    ],

    /**
     * 詳細度の降順を許可
     * 理由: BEM構造では詳細度管理が明確なため不要
     */
    'no-descending-specificity': null,

    /**
     * 重複セレクタを禁止
     * 理由: コードの保守性向上
     */
    'no-duplicate-selectors': null,

    // ========================================
    // 命名規則
    // ========================================

    /**
     * カスタムプロパティの命名規則
     * パターン: --name, --_name（プライベート変数）
     * 例: --color-primary, --_space
     */
    'custom-property-pattern': '^(_)?[a-z][a-z0-9]*(-[a-z0-9]+)*$',

    /**
     * !importantの使用を禁止
     * 理由: 詳細度を適切に管理することで解決すべき
     * 注意: ユーティリティクラスや外部ライブラリの上書きなど、
     *       プロジェクトの方針で例外を認める場合は手動でルール無効化が必要
     */
    'declaration-no-important': [
      true,
      {
        message: '!importantは使用できません。詳細度を適切に管理してください'
      }
    ],

    /**
     * クラス名の命名規則（BEM）
     * パターン:
     * - BEM Element: __element
     * - BEM Modifier: --modifier
     * - ハイフン区切り: kebab-case
     *
     * 例:
     * - .button
     * - .button__anchor
     * - .button--primary
     * - .about-banner
     */
    'selector-class-pattern':
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z][a-z0-9]*(-[a-z0-9]+)*)?(--[a-z][a-z0-9]*(-[a-z0-9]+)*)?$',

    /**
     * z-indexの値を制限
     * 理由: 重なり順の管理を簡素化
     * OK: z-index: 1, z-index: -1, z-index: var(--z-index), z-index: calc(...)
     * NG: z-index: 999, z-index: 10, z-index: 2
     */
    'declaration-property-value-allowed-list': [
      {
        'z-index': ['/^-?1$/', '/^var\(--/', '/^calc\(/']
        /**
         * text-alignプロパティの値を制限
         * 理由: 国際化対応（書字方向に依存しない設計）
         * OK: text-align: start, text-align: end, text-align: center, text-align: justify, text-align: unset
         * NG: text-align: left, text-align: right（LTR/RTL文字列混在時に非対応）
         */
      },
      {
        message: (value, property) => {
          if (property === 'z-index') {
            return 'z-indexは1、-1、CSS変数（var(--）、またはcalc()のみ使用できます。他の値が必要な場合は設計を見直してください'
          }
          return '許可されていない値です'
        }
      }
    ],

    /**
     * line-heightの単位を禁止
     * 理由: 単位なしの相対値を推奨（継承の問題を防ぐ）
     * NG: line-height: 24px
     * OK: line-height: 1.5
     */
    'declaration-property-unit-allowed-list': [
      {
        'line-height': []
      },
      {
        message: 'line-heightには単位を付けないでください。単位なしの相対値（1.5など）を使用してください'
      }
    ],

    /**
     * 未知のプロパティ値を許可
     * 理由: プロジェクトのカスタム関数（px()など）を使用
     */
    'declaration-property-value-no-unknown': null,

    /**
     * ショートハンドプロパティの冗長性チェックを無効化
     * 理由: 個別プロパティの使用を推奨
     * 推奨: background-color vs background
     */
    'declaration-block-no-redundant-longhand-properties': null,

    // ========================================
    // フォント・テキスト
    // ========================================

    /**
     * フォントファミリー名の引用符を適切に管理
     * 理由: スペース含むフォント名の安全性
     * OK: font-family: "Noto Sans JP", sans-serif
     */
    'font-family-name-quotes': 'always-where-recommended',

    /**
     * font-weightを数値形式で統一
     * 理由: 細かい制御が可能
     * NG: font-weight: bold
     * OK: font-weight: 700
     * 例外: font-weight: bolder（relative）
     */
    'font-weight-notation': [
      'numeric',
      {
        ignore: ['relative']
      }
    ],

    // ========================================
    // 関数・URL
    // ========================================

    /**
     * 未知の関数を許可
     * 理由: プロジェクトのカスタム関数（px(), svg-uri()など）を使用
     */
    'function-no-unknown': null,

    /**
     * URLに引用符を強制
     * 理由: セキュリティ向上、パス内のスペース対応
     * NG: url(../img/logo.svg)
     * OK: url('../img/logo.svg')
     */
    'function-url-quotes': 'always',

    /**
     * プロトコル相対URLを禁止
     * 理由: セキュリティリスク
     * NG: url(//example.com/image.jpg)
     */
    'function-url-no-scheme-relative': true,

    // ========================================
    // 単位・数値
    // ========================================

    /**
     * 0値に単位を付けない
     * 理由: 不要な単位を削除
     * NG: margin: 0px
     * OK: margin: 0
     * 例外: カスタムプロパティ（--_: 0px）
     */
    'length-zero-no-unit': [
      true,
      {
        ignore: ['custom-properties']
      }
    ],

    /**
     * 小数点以下の桁数を5桁までに制限
     * 理由: 過度な精度を防止
     */
    'number-max-precision': 5,

    /**
     * 古いビューポート単位の使用を警告
     * 理由: svw, dvw, lvwなどのモダンな単位を推奨
     * 警告: vw, vh, vi, vb, vmin, vmax
     * 推奨: svw, dvw, lvw, svh, dvh, lvh
     */
    'unit-disallowed-list': [
      ['vw', 'vh', 'vi', 'vb', 'vmin', 'vmax'],
      {
        severity: 'warning'
      }
    ],

    // ========================================
    // その他の値
    // ========================================

    /**
     * メディアクエリの値を検証
     */
    'media-feature-name-value-no-unknown': true,

    /**
     * キーワード値を小文字に統一
     * 例外: SVGキーワードはキャメルケースを許可
     */
    'value-keyword-case': [
      'lower',
      {
        camelCaseSvgKeywords: true
      }
    ],

    // ========================================
    // プロパティ
    // ========================================

    /**
     * 未知のプロパティを禁止（例外あり）
     * 例外: 実験的なCSS機能
     */
    'property-no-unknown': [
      true,
      {
        ignoreProperties: [
          'text-decoration-inset',
          'field-sizing',
          'reading-flow',
          'reading-order',
          'navigation',
          'interpolate-size',
          'text-box',
          'interactivity',
          'corner-shape'
        ]
      }
    ],

    /**
     * ベンダープレフィックスを制限（例外あり）
     * 例外: Autoprefixerでカバーされないプロパティ
     */
    'property-no-vendor-prefix': [
      true,
      {
        ignoreProperties: ['backdrop-filter', 'mask', 'mask-image', 'text-size-adjust', 'appearance']
      }
    ],

    /**
     * 非推奨プロパティを条件付きで許可
     * 理由:
     * - Chromiumブラウザのバグ対応で -webkit-user-modify が必要
     * - visually-hidden パターンで clip が標準的に使用される（Bootstrap/Tailwind準拠）
     */
    'property-no-deprecated': [
      true,
      {
        ignoreProperties: ['-moz-user-modify', '-webkit-user-modify', 'clip']
      }
    ],

    /**
     * 無効なposition宣言チェックを無効化
     * 理由: stylelint v17の新ルールがCSS変数（--_name）を誤検知
     * TODO: stylelint側で修正されたら再有効化を検討
     */
    'no-invalid-position-declaration': null,

    // ========================================
    // SCSS固有のルール
    // ========================================

    /**
     * 未知のat-ruleを許可
     * 理由: @container, @starting-styleなど最新CSS機能を使用
     */
    'scss/at-rule-no-unknown': null,

    /**
     * Sass変数宣言前の空行を強制
     * 例外: 最初のネスト、変数の連続、コメント後
     */
    'scss/dollar-variable-empty-line-before': [
      'always',
      {
        except: ['first-nested', 'after-dollar-variable'],
        ignore: ['after-comment']
      }
    ],

    /**
     * Sass変数の命名規則
     * パターン: kebab-case
     * 例: $color-primary, $grid-breakpoints
     */
    'scss/dollar-variable-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',

    /**
     * Sassプレースホルダーの命名規則
     * パターン: kebab-case
     * 例: %clearfix, %button-base
     */
    'scss/percent-placeholder-pattern': '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',

    /**
     * グローバル関数名を禁止し、名前空間付き関数を強制
     * 理由: Dart Sassのベストプラクティス
     * NG: map-get($map, key)
     * OK: map.get($map, key)
     */
    'scss/no-global-function-names': [
      true,
      {
        message: 'グローバル関数は非推奨です。名前空間付き関数を使用してください。例: map-get() → map.get()'
      }
    ],

    /**
     * @use/@forwardでのパーシャル拡張子を禁止
     * 理由: Sass公式推奨（ファイル形式の変更に対応）
     * NG: @use "./variables.scss"
     * OK: @use "./variables"
     */
    'scss/load-partial-extension': 'never',

    // ========================================
    // フォーマット・空白行
    // ========================================

    /**
     * コメント前の空行を強制
     * 理由: セクション区切りの可読性向上
     * 例外: 最初のネスト、連続するコメント
     */
    'comment-empty-line-before': [
      'always',
      {
        except: ['first-nested'],
        ignore: ['stylelint-commands', 'after-comment']
      }
    ],

    /**
     * プロパティ宣言前の空行を許可
     * 理由: プロパティ間に空行を入れない書き方を採用
     */
    'declaration-empty-line-before': null,

    /**
     * ルール前の空行を条件付きで強制
     * 理由: 可読性向上
     * 例外: 最初のネスト、コメント後
     */
    'rule-empty-line-before': [
      'always-multi-line',
      {
        except: ['first-nested'],
        ignore: ['after-comment']
      }
    ]
  }
}
