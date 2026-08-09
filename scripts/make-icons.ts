/**
 * public/icon.svg から各サイズの PNG を書き出す。
 * アイコンを直すときは icon.svg だけ編集して `npm run icons` を実行する。
 *
 * iOS のホーム画面は SVG を使えないので PNG が必須。
 * Android(maskable) は端末側で円形などに切るため、顔を中央の安全域に収めてある。
 */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const SRC = 'public/icon.svg'

const TARGETS = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  /** iOS のホーム画面用。透過を許さないので背景ごと焼き込む */
  { file: 'public/apple-touch-icon.png', size: 180 },
  /** ブラウザのタブ用 */
  { file: 'public/favicon-32.png', size: 32 },
]

const svg = await readFile(SRC)

for (const { file, size } of TARGETS) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(file, png)
  console.log(`${file} (${size}x${size}) ${(png.length / 1024).toFixed(1)}kB`)
}
