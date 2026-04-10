import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const rootDir = process.cwd()
const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res')
const sourceSvgPath = path.join(rootDir, 'public', 'pwa', 'icon-512.svg')

const densitySizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
]

const sourceSvg = await readFile(sourceSvgPath)

function createCircleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="black"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
    'utf8',
  )
}

for (const density of densitySizes) {
  const outputDir = path.join(androidResDir, density.folder)
  await mkdir(outputDir, { recursive: true })

  const squareIcon = sharp(sourceSvg).resize(density.size, density.size, { fit: 'cover' }).png()

  await squareIcon.clone().toFile(path.join(outputDir, 'ic_launcher.png'))

  const circleMask = createCircleMask(density.size)
  await squareIcon
    .clone()
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .toFile(path.join(outputDir, 'ic_launcher_round.png'))
}

console.log('Android launcher icons generated from public/pwa/icon-512.svg')