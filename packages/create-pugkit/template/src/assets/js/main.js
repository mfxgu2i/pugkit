// 機能を足すときは、import と対応表に1行ずつ追加する
// import * as carousel from './_carousel'

/**
 * ルートを持つ機能。マークアップが data-module で名乗る
 * プロトタイプを持たせない。registry['constructor'] が関数を返すのを防ぐ
 */
const registry = Object.assign(Object.create(null), {
  // carousel
})

/**
 * ルートを持たない機能。ページ全体に効くものを載せる
 */
const globals = {
  // smoothScroll
}

/**
 * モジュールを1つ初期化する。失敗はここで閉じる
 * @param {string} name
 * @param {{ initialize: (element?: Element) => unknown }} module
 * @param {Element} [element]
 */
const run = (name, module, element) => {
  try {
    const result = module.initialize(element)
    // 非同期の initialize は、返ってきた Promise の失敗も拾う
    if (result instanceof Promise) result.catch(error => console.error(name, error))
  } catch (error) {
    console.error(name, error)
  }
}

const start = () => {
  for (const [name, module] of Object.entries(globals)) {
    run(name, module)
  }

  document.querySelectorAll('[data-module]').forEach(element => {
    for (const name of element.dataset.module.split(/\s+/).filter(Boolean)) {
      const module = registry[name]

      if (!module) {
        console.error(`data-module="${name}" に対応するモジュールが無い`)
        continue
      }

      run(name, module, element)
    }
  })
}

// スクリプトの読み込み方を変えた案件では、登録より先に解析が終わっていることがある
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start)
} else {
  start()
}
