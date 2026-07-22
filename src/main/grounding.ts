import sharp from "sharp";
import type { ScreenContrastMap } from "../shared/types";

const GRID_DIVISIONS = 10;

/**
 * Adds a private coordinate scaffold to the image sent to the VLM. The clean
 * capture remains the source rendered back to the learner.
 */
export async function createGroundingImageDataUrl(png: Buffer): Promise<string> {
  const pipeline = sharp(png, { failOn: "error", limitInputPixels: 80_000_000 });
  const metadata = await pipeline.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("The capture has no usable pixel dimensions.");

  const output = await pipeline
    .composite([{ input: Buffer.from(buildCoordinateScaffold(width, height)), blend: "over" }])
    .png({ compressionLevel: 6 })
    .toBuffer();
  return `data:image/png;base64,${output.toString("base64")}`;
}

export async function createScreenContrastMap(
  png: Buffer,
  columns = 24,
  rows = 14,
): Promise<ScreenContrastMap> {
  const safeColumns = Math.max(4, Math.min(48, Math.round(columns)));
  const safeRows = Math.max(4, Math.min(32, Math.round(rows)));
  const { data, info } = await sharp(png, { failOn: "error", limitInputPixels: 80_000_000 })
    .resize(safeColumns, safeRows, { fit: "fill", kernel: "mitchell" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance: number[] = [];
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? red;
    const blue = data[offset + 2] ?? red;
    luminance.push(Number(((0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255).toFixed(4)));
  }
  return { columns: safeColumns, rows: safeRows, luminance };
}

export function buildCoordinateScaffold(width: number, height: number): string {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const shortestSide = Math.min(safeWidth, safeHeight);
  const lineWidth = Math.max(1, Math.round(shortestSide / 900));
  const fontSize = Math.max(11, Math.min(22, Math.round(shortestSide / 68)));
  const outline = Math.max(2, Math.round(fontSize / 5));
  const vertical: string[] = [];
  const horizontal: string[] = [];
  const labels: string[] = [];

  for (let index = 1; index < GRID_DIVISIONS; index += 1) {
    const normalized = index * 100;
    const x = Math.round((safeWidth * index) / GRID_DIVISIONS);
    const y = Math.round((safeHeight * index) / GRID_DIVISIONS);
    vertical.push(`<path d="M ${x} 0 V ${safeHeight}"/>`);
    horizontal.push(`<path d="M 0 ${y} H ${safeWidth}"/>`);
    labels.push(
      `<text x="${x + 4}" y="${fontSize + 3}">x${normalized}</text>`,
      `<text x="4" y="${Math.max(fontSize, y - 4)}">y${normalized}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
  <g fill="none" stroke="#00d9ff" stroke-width="${lineWidth}" stroke-dasharray="${lineWidth * 2} ${lineWidth * 6}" opacity="0.2">
    ${vertical.join("\n    ")}
    ${horizontal.join("\n    ")}
  </g>
  <rect x="${lineWidth / 2}" y="${lineWidth / 2}" width="${Math.max(0, safeWidth - lineWidth)}" height="${Math.max(0, safeHeight - lineWidth)}" fill="none" stroke="#00d9ff" stroke-width="${lineWidth}" opacity="0.45"/>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#8decff" stroke="#001116" stroke-width="${outline}" paint-order="stroke" opacity="0.92">
    ${labels.join("\n    ")}
  </g>
</svg>`;
}
