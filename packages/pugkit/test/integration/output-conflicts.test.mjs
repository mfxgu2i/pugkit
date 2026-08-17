import { describe, expect, it, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { writeFile, mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import { assertUniqueOutputs } from '../../core/output-conflicts.mjs'
import { imageTask } from '../../tasks/image.mjs'
import { createTempProject, listFiles } from '../helpers/project.mjs'

/**
 * 出力先の一意性。
 *
 * image / svg / copy は同じフェーズで並列に走るため、同じ場所に二人以上が書くと
 * どちらが残るかは書き込みが着地した順で決まる。片方を黙って捨てると
 * 「置いたはずのファイルが使われていない」ことに気づけないので中止する。
 */
let project
let context

async function createJpeg(filePath, width = 200, height = 150) {
  await sharp({ create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } } })
    .jpeg()
    .toFile(filePath)
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'

beforeEach(async () => {
  project = await createTempProject({ 'src/.keep': '', 'public/.keep': '', 'dist/.keep': '' })
  context = {
    paths: { src: project.path('src'), public: project.path('public'), output: project.path('dist') },
    config: {
      build: {
        image: {
          format: 'webp',
          sourceDensity: 2,
          options: { webp: { quality: 30, effort: 0 } },
          overrides: {}
        }
      }
    }
  }
})

describe('assertUniqueOutputs', () => {
  it('衝突が無ければ何も起きない', async () => {
    await createJpeg(project.path('src/hero.jpg'))
    await writeFile(project.path('src/logo.svg'), svg)
    await writeFile(project.path('public/favicon.ico'), 'x')

    await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
  })

  describe('画像', () => {
    it('別のソースが同じ出力先に写像したら中止する', async () => {
      // webp モードでは logo.jpg と logo.png がどちらも logo.webp になる
      await createJpeg(project.path('src/logo.jpg'))
      await createJpeg(project.path('src/logo.png'))

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/logo\.webp/)
    })

    it('public と同じ出力先になったら中止する', async () => {
      await createJpeg(project.path('src/hero.jpg'))
      await writeFile(project.path('public/hero.webp'), 'public-wins')

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/hero\.webp/)
    })

    it('拡張子が変換されるので、同名でも衝突しない組み合わせがある', async () => {
      // webp モードでは src/logo.png -> logo.webp、public/logo.png はそのまま
      await createJpeg(project.path('src/logo.png'))
      await writeFile(project.path('public/logo.png'), 'x')

      await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
    })
  })

  describe('SVG', () => {
    it('src と public に同名の SVG があれば中止する', async () => {
      await writeFile(project.path('src/logo.svg'), svg)
      await writeFile(project.path('public/logo.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/logo\.svg/)
    })

    it('スプライトの出力先が public と衝突したら中止する', async () => {
      await mkdir(project.path('src/assets/icons'), { recursive: true })
      await writeFile(project.path('src/assets/icons/arrow.svg'), svg)
      await mkdir(project.path('public/assets'), { recursive: true })
      await writeFile(project.path('public/assets/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/icons\.svg/)
    })

    // src 直下の icons/ は dist/icons.svg に出る。出力先の導出が生成側とずれると
    // 衝突を取りこぼす
    it('src 直下の icons ディレクトリでも出力先が衝突したら中止する', async () => {
      await mkdir(project.path('src/icons'), { recursive: true })
      await writeFile(project.path('src/icons/arrow.svg'), svg)
      await writeFile(project.path('public/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/icons\.svg/)
    })

    it('サブディレクトリのアイコンだけでもスプライトの出力先を見る', async () => {
      await mkdir(project.path('src/assets/icons/social'), { recursive: true })
      await writeFile(project.path('src/assets/icons/social/x.svg'), svg)
      await mkdir(project.path('public/assets'), { recursive: true })
      await writeFile(project.path('public/assets/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/icons\.svg/)
    })
  })

  it('衝突の相手が両方分かるメッセージを出す', async () => {
    await createJpeg(project.path('src/logo.jpg'))
    await createJpeg(project.path('src/logo.png'))

    const error = await assertUniqueOutputs(context).catch(e => e)

    expect(error.message).toContain('src/logo.jpg')
    expect(error.message).toContain('src/logo.png')
  })

  it('衝突を全件まとめて報告する（直すたびに走り直させない）', async () => {
    await createJpeg(project.path('src/logo.jpg'))
    await createJpeg(project.path('src/logo.png'))
    await writeFile(project.path('src/mark.svg'), svg)
    await writeFile(project.path('public/mark.svg'), svg)

    const error = await assertUniqueOutputs(context).catch(e => e)

    expect(error.message).toContain('logo.webp')
    expect(error.message).toContain('mark.svg')
  })
})

/**
 * 幅違いは相対パスから列挙できないので、突き合わせでは見られない。
 * ビルドが作る形の名前を置かせないことで肩代わりする（docs/adr/0011）
 */
describe('予約された名前', () => {
  it.each(['src/hero@half.jpg', 'src/hero@400w.jpg', 'src/hero@1200w.png'])('%s は中止する', async path => {
    await createJpeg(project.path(path))

    await expect(assertUniqueOutputs(context)).rejects.toThrow(/別の名前にしてください/)
  })

  it('public に置いた場合も中止する', async () => {
    await createJpeg(project.path('public/hero@400w.webp'))

    await expect(assertUniqueOutputs(context)).rejects.toThrow(/public\/hero@400w\.webp/)
  })

  /** @2x はデザインツールの書き出し名として実在する。予約すると支給素材が置けなくなる */
  it('@2x は中止しない', async () => {
    await createJpeg(project.path('src/hero@2x.jpg'))

    await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
  })

  it('画像でないファイルは名前が同じ形でも中止しない', async () => {
    await writeFile(project.path('public/report@400w.pdf'), 'x')

    await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
  })

  /**
   * icons.svg はスプライトの出力名。icons ディレクトリが後から増えると衝突するので、
   * ディレクトリの有無に関わらず置かせない
   */
  describe('icons.svg', () => {
    it('src に置いたら中止する', async () => {
      await mkdir(project.path('src/assets'), { recursive: true })
      await writeFile(project.path('src/assets/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/別の名前にしてください/)
    })

    it('public に置いたら中止する', async () => {
      await writeFile(project.path('public/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/public\/icons\.svg/)
    })

    it('icons ディレクトリが無くても中止する', async () => {
      await writeFile(project.path('src/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/src\/icons\.svg/)
    })

    it('icons ディレクトリの中の icons.svg は対象外（スプライトの材料であって出力ではない）', async () => {
      await mkdir(project.path('src/assets/icons'), { recursive: true })
      await writeFile(project.path('src/assets/icons/icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
    })

    it('名前が違えば中止しない', async () => {
      await writeFile(project.path('src/my-icons.svg'), svg)

      await expect(assertUniqueOutputs(context)).resolves.toBeUndefined()
    })
  })

  it('衝突と同じ例外にまとめる（片方を直してまた止まらないように）', async () => {
    await createJpeg(project.path('src/logo.jpg'))
    await createJpeg(project.path('src/logo.png'))
    await createJpeg(project.path('src/hero@400w.jpg'))

    const error = await assertUniqueOutputs(context).catch(e => e)

    expect(error.message).toContain('logo.webp')
    expect(error.message).toContain('src/hero@400w.jpg')
  })
})

describe('タスク側は衝突を見ない', () => {
  /**
   * 衝突の判定はタスクをまたぐ情報が要るので、タスクの外（build 前 / dev 起動時）で
   * 一度だけ行う。保存のたびに走らせないのは dev の軽さを優先しているため
   */
  it('imageTask は衝突があっても中止せずに処理する', async () => {
    await createJpeg(project.path('src/logo.jpg'))
    await createJpeg(project.path('src/logo.png'))

    await expect(imageTask(context)).resolves.toBeUndefined()
    // 前提: 実際に出力まで進んでいる
    expect(await listFiles(project.path('dist'))).toContain('logo.webp')
  })
})
