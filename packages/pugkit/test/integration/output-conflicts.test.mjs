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
        imageOptimization: 'webp',
        imageSourceDensity: 2,
        imageOptions: { webp: { quality: 30, effort: 0 } },
        imageOverrides: {}
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
      // density 2 では hero.jpg が hero@half.webp を生むので、手置きの @half と衝突する
      await createJpeg(project.path('src/hero.jpg'))
      await createJpeg(project.path('src/hero@half.jpg'))

      await expect(assertUniqueOutputs(context)).rejects.toThrow(/hero@half\.webp/)
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
  })

  it('衝突の相手が両方分かるメッセージを出す', async () => {
    await createJpeg(project.path('src/hero.jpg'))
    await createJpeg(project.path('src/hero@half.jpg'))

    const error = await assertUniqueOutputs(context).catch(e => e)

    expect(error.message).toContain('src/hero.jpg')
    expect(error.message).toContain('src/hero@half.jpg')
  })

  it('衝突を全件まとめて報告する（直すたびに走り直させない）', async () => {
    await createJpeg(project.path('src/hero.jpg'))
    await createJpeg(project.path('src/hero@half.jpg'))
    await writeFile(project.path('src/logo.svg'), svg)
    await writeFile(project.path('public/logo.svg'), svg)

    const error = await assertUniqueOutputs(context).catch(e => e)

    expect(error.message).toContain('hero@half.webp')
    expect(error.message).toContain('logo.svg')
  })
})

describe('タスク側は衝突を見ない', () => {
  /**
   * 衝突の判定はタスクをまたぐ情報が要るので、タスクの外（build 前 / dev 起動時）で
   * 一度だけ行う。保存のたびに走らせないのは dev の軽さを優先しているため
   */
  it('imageTask は衝突があっても中止せずに処理する', async () => {
    await createJpeg(project.path('src/hero.jpg'))
    await createJpeg(project.path('src/hero@half.jpg'))

    await expect(imageTask(context)).resolves.toBeUndefined()
    // 前提: 実際に出力まで進んでいる
    expect(await listFiles(project.path('dist'))).toContain('hero.webp')
  })
})
