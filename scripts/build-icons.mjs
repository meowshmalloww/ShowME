import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = process.cwd();
const source = join(root, "assets", "showme-icon-source.png");
const png = join(root, "assets", "icon.png");
const sizes = [16, 24, 32, 48, 64, 128, 256];

const master = await sharp(source)
  .extract({ left: 64, top: 64, width: 1126, height: 1126 })
  .resize(1024, 1024)
  .greyscale()
  .threshold(150)
  .tint("#f4f2ed")
  .ensureAlpha()
  .composite([
    {
      input: Buffer.from(
        '<svg width="1024" height="1024"><rect width="1024" height="1024" rx="184" fill="white"/></svg>',
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

await writeFile(png, master);
const buffers = await Promise.all(
  sizes.map((size) => sharp(master).resize(size, size).png().toBuffer()),
);
await writeFile(join(root, "assets", "icon.ico"), await pngToIco(buffers));
await readFile(png);
