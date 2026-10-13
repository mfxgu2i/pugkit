// scrollend が無いブラウザで、スクロールが止まったとみなすまでの間隔
const SCROLL_END_DELAY = 100

// 他のハンドラが preventDefault() してスクロールが一度も起きなかったときに、scroll-behavior を戻すまでの上限
const FALLBACK_DURATION = 5000

const supportsScrollEnd = 'onscrollend' in window

/** @type {(() => void) | null} */
let cleanup = null

/**
 * 追従するヘッダーの高さを返す。追従しないヘッダーは要素と一緒に流れるのでずらさない
 * @returns {string}
 */
const getHeaderBlockSize = () => {
  const header = document.querySelector('[data-fixed-header]')

  if (!header) return '0'

  const { position, blockSize } = window.getComputedStyle(header)
  const isFixed = position === 'fixed' || position === 'sticky'

  return isFixed ? blockSize : '0'
}

const updateScrollPadding = () => {
  document.documentElement.style.scrollPaddingBlockStart = getHeaderBlockSize()
}

const restoreScrollBehavior = () => {
  if (!cleanup) return

  const run = cleanup
  cleanup = null
  run()
}

/**
 * 次に起きるスクロールだけを滑らかにする。
 * 終わりは時間で決め打ちしない。途中で scroll-behavior を戻すとスクロールがその場で止まる
 */
const enableSmoothOnce = () => {
  restoreScrollBehavior()

  const html = document.documentElement
  html.style.scrollBehavior = 'smooth'

  let backstop = setTimeout(restoreScrollBehavior, FALLBACK_DURATION)
  let debounce = null

  const handleScroll = () => {
    clearTimeout(backstop)

    if (supportsScrollEnd) return

    clearTimeout(debounce)
    debounce = setTimeout(restoreScrollBehavior, SCROLL_END_DELAY)
  }

  window.addEventListener('scroll', handleScroll, { passive: true })

  if (supportsScrollEnd) {
    window.addEventListener('scrollend', restoreScrollBehavior, { passive: true })
  }

  cleanup = () => {
    clearTimeout(backstop)
    clearTimeout(debounce)
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('scrollend', restoreScrollBehavior)
    html.style.scrollBehavior = ''
  }
}

/**
 * 遷移そのものはブラウザに任せ、滑らかにするかどうかだけを決める。
 * preventDefault() すると、フォーカスの移動や details の自動展開をブラウザから奪う
 * @param {MouseEvent} event
 */
const handleClick = event => {
  const link = event.target instanceof Element ? event.target.closest('a[href*="#"]') : null

  if (!link || link.getAttribute('data-smooth-scroll') === 'disabled') return

  updateScrollPadding()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  enableSmoothOnce()
}

/**
 * ページ内リンクのスクロールを滑らかにする。ルートを持たないので globals に載せる。
 * `[data-fixed-header]` を付けたヘッダーの高さだけ、着地位置を手前にずらす。
 * `data-smooth-scroll="disabled"` を付けたアンカーは滑らかにしない
 */
export const initialize = () => {
  updateScrollPadding()

  window.addEventListener('resize', updateScrollPadding)

  document.addEventListener('click', handleClick, { capture: true })
}
