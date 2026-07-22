import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gallery = path.join(root, 'artifacts', 'submission', 'gallery')
const output = path.join(root, 'artifacts', 'submission', 'ShowME-Devpost-Thumbnail.png')

const width = 1920
const height = 1080

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

async function roundedScreenshot(file, targetWidth, targetHeight, radius) {
  const mask = Buffer.from(
    `<svg width="${targetWidth}" height="${targetHeight}"><rect width="${targetWidth}" height="${targetHeight}" rx="${radius}" fill="white"/></svg>`,
  )

  return sharp(file)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'centre' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

function frameSvg(x, y, frameWidth, frameHeight, radius, stroke, opacity = 1) {
  return Buffer.from(`<svg width="${width}" height="${height}">
    <defs>
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="18"/>
      </filter>
    </defs>
    <rect x="${x + 8}" y="${y + 18}" width="${frameWidth}" height="${frameHeight}" rx="${radius}" fill="#000" opacity="0.68" filter="url(#shadow)"/>
    <rect x="${x - 2}" y="${y - 2}" width="${frameWidth + 4}" height="${frameHeight + 4}" rx="${radius + 2}" fill="none" stroke="${stroke}" stroke-width="2" opacity="${opacity}"/>
  </svg>`)
}

const home = await roundedScreenshot(
  path.join(gallery, '01-showme-home.png'),
  1240,
  698,
  24,
)
const math = await roundedScreenshot(
  path.join(gallery, '02-math-whiteboard.png'),
  510,
  287,
  18,
)
const code = await roundedScreenshot(
  path.join(gallery, '03-code-event-loop.png'),
  510,
  287,
  18,
)
const physics = await roundedScreenshot(
  path.join(gallery, '05-physics-simulation.png'),
  510,
  287,
  18,
)

const title = 'ShowME'
const tagline = "DON'T EXPLAIN IT. MAKE IT VISIBLE."

const background = Buffer.from(`<svg width="${width}" height="${height}">
  <defs>
    <radialGradient id="cyanGlow" cx="70%" cy="25%" r="65%">
      <stop offset="0" stop-color="#123147" stop-opacity="0.58"/>
      <stop offset="0.55" stop-color="#071016" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#050606" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="amberLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f5ae35"/>
      <stop offset="1" stop-color="#ff765e"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#060707"/>
  <rect width="${width}" height="${height}" fill="url(#cyanGlow)"/>
  <path d="M 0 1038 H 1920" stroke="#202326" stroke-width="2"/>
  <path d="M 82 490 H 468" stroke="url(#amberLine)" stroke-width="6"/>
  <path d="M 468 490 H 530" stroke="#363a3d" stroke-width="2"/>
  <circle cx="468" cy="490" r="8" fill="#f5ae35"/>
</svg>`)

const typography = Buffer.from(`<svg width="${width}" height="${height}">
  <style>
    .ui { font-family: "Segoe UI", Arial, sans-serif; }
  </style>
  <text class="ui" x="82" y="246" fill="#f5f3ed" font-size="136" font-weight="760" letter-spacing="-7">${escapeXml(title)}</text>
  <text class="ui" x="88" y="326" fill="#aeb4ba" font-size="27" font-weight="600" letter-spacing="1">${escapeXml(tagline)}</text>
  <text class="ui" x="88" y="452" fill="#7e878e" font-size="19" font-weight="700" letter-spacing="4">YOUR SCREEN → A VISUAL LESSON</text>
</svg>`)

const icon = await sharp(path.join(root, 'assets', 'icon.png'))
  .resize(76, 76, { fit: 'contain' })
  .png()
  .toBuffer()

const layers = [
  { input: background, left: 0, top: 0 },
  { input: frameSvg(590, 74, 1240, 698, 24, '#3e464c', 0.95), left: 0, top: 0 },
  { input: home, left: 590, top: 74 },
  { input: frameSvg(78, 735, 510, 287, 18, '#f5ae35', 0.9), left: 0, top: 0 },
  { input: math, left: 78, top: 735 },
  { input: frameSvg(705, 735, 510, 287, 18, '#76d2ff', 0.9), left: 0, top: 0 },
  { input: code, left: 705, top: 735 },
  { input: frameSvg(1332, 735, 510, 287, 18, '#a78bfa', 0.9), left: 0, top: 0 },
  { input: physics, left: 1332, top: 735 },
  { input: typography, left: 0, top: 0 },
  { input: icon, left: 88, top: 82 },
]

await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: '#060707',
  },
})
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toFile(output)

console.log(output)
