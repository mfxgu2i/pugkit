const site = {
  start() {
    try {
      console.log('サイトの初期化に成功')
    } catch (error) {
      console.error('サイト初期化:', error)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => site.start())
