import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const source = join(root, "docs", "media", "source", "showme-workspace-clean.png");
const output = join(root, "docs", "media", "showme-devpost-thumbnail.png");

const width = 1536;
const height = 1024;
const screenshot = {
  x: 352,
  y: 136,
  width: 1130,
  height: 748,
  radius: 14,
};

const screenshotMask = Buffer.from(`
  <svg width="${screenshot.width}" height="${screenshot.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" rx="${screenshot.radius}" fill="#fff"/>
  </svg>
`);

const productScreenshot = await sharp(source)
  .resize(screenshot.width, screenshot.height, { fit: "cover", position: "centre" })
  .composite([{ input: screenshotMask, blend: "dest-in" }])
  .png()
  .toBuffer();

const artwork = Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1536" height="1024" fill="#f1eee7"/>
    <rect width="404" height="1024" fill="#0b0b0b"/>

    <g opacity="0.22" stroke="#77736b" stroke-width="1">
      <line x1="404" y1="72" x2="1536" y2="72"/>
      <line x1="404" y1="952" x2="1536" y2="952"/>
      <line x1="1450" y1="0" x2="1450" y2="1024"/>
    </g>

    <g transform="translate(62 64)" fill="none" stroke="#f5f2eb" stroke-width="5" stroke-linecap="square">
      <path d="M0 16V0H16 M46 0H62V16 M62 46V62H46 M16 62H0V46"/>
      <rect x="22" y="22" width="18" height="18" fill="#f5f2eb" stroke="none"/>
    </g>

    <text x="62" y="184" fill="#f5f2eb" font-family="Segoe UI, Arial, sans-serif" font-size="62" font-weight="800" letter-spacing="-3">ShowME</text>

    <text x="62" y="282" fill="#f5f2eb" font-family="Segoe UI, Arial, sans-serif" font-size="39" font-weight="750" letter-spacing="-1">
      <tspan x="62" dy="0">DON'T</tspan>
      <tspan x="62" dy="48">EXPLAIN IT.</tspan>
      <tspan x="62" dy="58">MAKE IT</tspan>
      <tspan x="62" dy="48">VISIBLE.</tspan>
    </text>

    <rect x="62" y="512" width="86" height="7" fill="#e8a52c"/>
    <text x="62" y="560" fill="#aaa69e" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="650" letter-spacing="2.4">SCREEN → UNDERSTANDING</text>

    <g fill="#f5f2eb" font-family="Segoe UI, Arial, sans-serif">
      <text x="62" y="856" font-size="13" font-weight="650" letter-spacing="2.5">POINT</text>
      <text x="62" y="892" font-size="13" font-weight="650" letter-spacing="2.5">ASK</text>
      <text x="62" y="928" font-size="13" font-weight="650" letter-spacing="2.5">SEE</text>
    </g>
    <g fill="#e8a52c">
      <circle cx="128" cy="851" r="3"/>
      <circle cx="108" cy="887" r="3"/>
      <circle cx="102" cy="923" r="3"/>
    </g>

    <rect x="370" y="154" width="1130" height="748" rx="14" fill="#c8c1b5" opacity="0.62"/>
    <rect x="340" y="124" width="1154" height="772" rx="18" fill="#111"/>

    <g stroke="#e8a52c" stroke-width="6" fill="none" stroke-linecap="square">
      <path d="M326 180V110H396"/>
      <path d="M1510 840V910H1440"/>
    </g>

    <text x="352" y="942" fill="#171717" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="750" letter-spacing="2.8">SELECT ANYTHING. BUILD A VISUAL LESSON.</text>
    <rect x="1372" y="925" width="110" height="4" fill="#171717"/>
  </svg>
`);

await sharp(artwork)
  .composite([{ input: productScreenshot, left: screenshot.x, top: screenshot.y }])
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

console.log(output);
