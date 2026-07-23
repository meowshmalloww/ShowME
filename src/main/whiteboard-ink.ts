import sharp from "sharp";
import type { PreparedContext, WhiteboardInkContext, WhiteboardInkStroke } from "../shared/types";
import { createGroundingImageDataUrl } from "./grounding";

const MAX_DECODED_INK_BYTES = 6_000_000;
const MAX_DECODED_CONTEXT_BYTES = 32_000_000;

export async function contextWithWhiteboardInk(
  context: PreparedContext,
  ink: WhiteboardInkContext,
): Promise<PreparedContext> {
  const base = decodePngDataUrl(context.previewDataUrl, MAX_DECODED_CONTEXT_BYTES);
  const overlay = decodePngDataUrl(ink.imageDataUrl, MAX_DECODED_INK_BYTES);
  const overlayImage = sharp(overlay, {
    failOn: "error",
    limitInputPixels: 80_000_000,
  });
  const metadata = await overlayImage.metadata();
  const overlayWidth = metadata.width ?? 0;
  const overlayHeight = metadata.height ?? 0;
  if (overlayWidth < 1 || overlayHeight < 1) {
    throw new Error("Whiteboard ink PNG has invalid dimensions.");
  }
  const crop = sourceCrop(
    ink.canvas,
    overlayWidth,
    overlayHeight,
  );
  const overlayPng = await overlayImage
    .extract(crop)
    .resize(context.pixelWidth, context.pixelHeight, { fit: "fill" })
    .png()
    .toBuffer();
  const composite = await sharp(base, {
    failOn: "error",
    limitInputPixels: 80_000_000,
  })
    .composite([{ input: overlayPng, blend: "over" }])
    .png()
    .toBuffer();
  const previewDataUrl = `data:image/png;base64,${composite.toString("base64")}`;
  return {
    ...context,
    previewDataUrl,
    analysisDataUrl: await createGroundingImageDataUrl(composite),
    containsAnnotations: true,
  };
}

export function describeWhiteboardInk(ink: WhiteboardInkContext): string {
  const descriptions = ink.strokes.map((stroke, index) => {
    const samples = samplePoints(stroke.points, 18)
      .map((point) => `${Math.round(point.x)},${Math.round(point.y)},p${point.pressure.toFixed(2)}`)
      .join(" ");
    return `${index + 1}. stroke ${stroke.id}; ${stroke.tool}, ${stroke.color}, width ${stroke.width.toFixed(1)}: ${samples}`;
  });
  return [
    "Learner ink is visible in the supplied image and is also described below.",
    "Learner stroke coordinates use a 0-1000 coordinate system across the entire lesson screen.",
    `The selected source occupies screen pixels left ${ink.canvas.sourceRect.left.toFixed(1)}, top ${ink.canvas.sourceRect.top.toFixed(1)}, width ${ink.canvas.sourceRect.width.toFixed(1)}, height ${ink.canvas.sourceRect.height.toFixed(1)} on a ${ink.canvas.width.toFixed(1)} by ${ink.canvas.height.toFixed(1)} screen.`,
    "Lesson primitives remain normalized to the selected source. Convert a learner screen point into selected-source coordinates before placing a response on the source.",
    ...descriptions,
    "Respond to the learner's marks directly. Preserve useful learner work, correct mistakes gently, and place new arrows, labels, equations, or shapes beside the relevant pixels instead of covering the source.",
  ].join("\n");
}

function sourceCrop(
  canvas: WhiteboardInkContext["canvas"],
  overlayWidth: number,
  overlayHeight: number,
): { left: number; top: number; width: number; height: number } {
  const scaleX = overlayWidth / canvas.width;
  const scaleY = overlayHeight / canvas.height;
  const left = Math.max(0, Math.min(overlayWidth - 1, Math.round(canvas.sourceRect.left * scaleX)));
  const top = Math.max(0, Math.min(overlayHeight - 1, Math.round(canvas.sourceRect.top * scaleY)));
  const right = Math.max(
    left + 1,
    Math.min(
      overlayWidth,
      Math.round((canvas.sourceRect.left + canvas.sourceRect.width) * scaleX),
    ),
  );
  const bottom = Math.max(
    top + 1,
    Math.min(
      overlayHeight,
      Math.round((canvas.sourceRect.top + canvas.sourceRect.height) * scaleY),
    ),
  );
  return { left, top, width: right - left, height: bottom - top };
}

function decodePngDataUrl(value: string, maximumBytes: number): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Whiteboard ink must be a base64 PNG.");
  const encoded = match.at(1);
  if (!encoded) throw new Error("Whiteboard ink PNG data is empty.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    throw new Error("Whiteboard image is empty or exceeds the safe size limit.");
  }
  return bytes;
}

function samplePoints<T>(points: T[], limit: number): T[] {
  if (points.length <= limit) return points;
  const result: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    const point = points.at(Math.round((index * (points.length - 1)) / (limit - 1)));
    if (point !== undefined) result.push(point);
  }
  return result;
}
