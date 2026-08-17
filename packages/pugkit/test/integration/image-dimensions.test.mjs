import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { imageSizeOf } from '../../utils/image-dimensions.mjs'
import { createTempProject } from '../helpers/project.mjs'

/**
 * 寸法の読み取り。imageInfo() が書く width / height と、dev の幅違い生成の
 * 剪定判定がここに乗る。読めない画像は例外にして、寸法の無い img を出さない。
 *
 * SVG は自前で読むので、ブラウザと同じ決め方（width/height → viewBox）を固定する
 */
let project
let write

const svg = (attributes, name = 'icon.svg') => write(name, `<svg ${attributes}><rect/></svg>`)

beforeEach(async () => {
  project = await createTempProject({ '.keep': '' })
  write = async (name, content) => {
    await writeFile(project.path(name), content)
    return project.path(name)
  }
})

describe('imageSizeOf', () => {
  describe('ラスタ', () => {
    it.each([
      ['jpeg', 'photo.jpg', 'jpg'],
      ['png', 'photo.png', 'png'],
      ['webp', 'photo.webp', 'webp'],
      ['avif', 'photo.avif', 'avif'],
      ['gif', 'photo.gif', 'gif']
    ])('%s の寸法と種別を読む', async (encoder, name, type) => {
      const path = project.path(name)
      await sharp({ create: { width: 123, height: 77, channels: 3, background: '#888' } })
        [encoder]()
        .toFile(path)

      expect(imageSizeOf(path)).toEqual({ width: 123, height: 77, type })
    })

    it('読めない中身は例外にする', async () => {
      const path = await write('broken.png', 'これは画像ではない')
      expect(() => imageSizeOf(path)).toThrow()
    })
  })

  describe('SVG', () => {
    it('width / height をそのまま読む', async () => {
      expect(imageSizeOf(await svg('width="40" height="20"'))).toEqual({ width: 40, height: 20, type: 'svg' })
    })

    it.each([
      ['px', 'width="40px" height="20px"', { width: 40, height: 20 }],
      ['pt', 'width="30pt" height="15pt"', { width: 40, height: 20 }],
      ['em', 'width="10em" height="5em"', { width: 160, height: 80 }]
    ])('%s の単位を px に直す', async (unit, attributes, expected) => {
      expect(imageSizeOf(await svg(attributes))).toEqual({ ...expected, type: 'svg' })
    })

    it('viewBox だけでも読む', async () => {
      expect(imageSizeOf(await svg('viewBox="0 0 40 20"'))).toEqual({ width: 40, height: 20, type: 'svg' })
    })

    /** カンマ区切りの viewBox も SVG の仕様どおり有効 */
    it('カンマ区切りの viewBox も読む', async () => {
      expect(imageSizeOf(await svg('viewBox="0,0,40,20"'))).toEqual({ width: 40, height: 20, type: 'svg' })
    })

    /** `100%` は viewBox の側で大きさが決まる。属性の見た目に釣られて 100 と書かない */
    it('割合指定は viewBox で決める', async () => {
      expect(imageSizeOf(await svg('width="100%" height="100%" viewBox="0 0 40 20"'))).toEqual({
        width: 40,
        height: 20,
        type: 'svg'
      })
    })

    it.each([
      ['width だけ', 'width="40" viewBox="0 0 80 40"'],
      ['height だけ', 'height="20" viewBox="0 0 80 40"']
    ])('%s のときは viewBox の縦横比で埋める', async (name, attributes) => {
      expect(imageSizeOf(await svg(attributes))).toEqual({ width: 40, height: 20, type: 'svg' })
    })

    it('小数は整数に丸める', async () => {
      expect(imageSizeOf(await svg('viewBox="0 0 40.6 20.2"'))).toEqual({ width: 41, height: 20, type: 'svg' })
    })

    it('宣言や改行をまたいでも開始タグを読む', async () => {
      const path = await write('icon.svg', '<?xml version="1.0"?>\n<!-- c -->\n<svg\n  width="40"\n  height="20"\n><rect/></svg>')
      expect(imageSizeOf(path)).toEqual({ width: 40, height: 20, type: 'svg' })
    })

    it('寸法をどこにも書いていない SVG は例外にする', async () => {
      const path = await write('icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
      expect(() => imageSizeOf(path)).toThrow()
    })
  })
})
