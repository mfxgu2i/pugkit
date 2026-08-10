/**
 * imageInfo() が要求した幅を画像ごとに集める。
 *
 * 幅は設定ではなく呼び出し側が決めるので、生成側は「どのページが何を要求したか」を
 * 知らないと作れない。BUILD_PHASES は pug を image より先に置いているため、
 * build ではここが埋まってから image タスクが走る（docs/adr/0011）。
 *
 * 同じ画像を複数のページが違う幅で参照したら和集合を作る。srcset はページごとに
 * 自分の指定を出すが、ファイルは要求された全部が要る。
 *
 * dev はこれを読まない。ページ HTML がキャッシュに載っているとレンダリングを
 * 通らないので、ここは常に「そのセッションで参照された幅の一部」でしかない。
 * dev の生成はリクエストされた URL だけで決める。
 */
export class ImageWidthRequests {
  constructor() {
    this.byImage = new Map()
  }

  /**
   * @param imagePath ソース画像の絶対パス
   * @param widths 剪定済みの幅。原寸以上のものが混ざっていると作れないファイルを要求することになる
   */
  record(imagePath, widths) {
    if (widths.length === 0) return

    const known = this.byImage.get(imagePath) ?? new Set()
    for (const width of widths) known.add(width)
    this.byImage.set(imagePath, known)
  }

  /** 昇順で返す。生成の順序を実行ごとに変えないため */
  get(imagePath) {
    const known = this.byImage.get(imagePath)
    return known ? [...known].sort((a, b) => a - b) : []
  }

  clear() {
    this.byImage.clear()
  }
}
