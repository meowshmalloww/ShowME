// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { contextWithWhiteboardInk, describeWhiteboardInk } from "../src/main/whiteboard-ink";
import type { PreparedContext, WhiteboardInkContext } from "../src/shared/types";

describe("interactive whiteboard ink", () => {
  it("composites learner ink over the selected pixels without changing dimensions", async () => {
    const base = await sharp({
      create: { width: 120, height: 80, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const overlay = await sharp({
      create: { width: 60, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="60" height="40"><path d="M5 20 L55 20" stroke="#52b8e8" stroke-width="6"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const context = preparedContext(`data:image/png;base64,${base.toString("base64")}`);
    const ink = inkContext(`data:image/png;base64,${overlay.toString("base64")}`);

    const result = await contextWithWhiteboardInk(context, ink);
    const preview = Buffer.from(result.previewDataUrl.split(",")[1] ?? "", "base64");
    const metadata = await sharp(preview).metadata();
    const center = await sharp(preview)
      .extract({ left: 58, top: 38, width: 4, height: 4 })
      .raw()
      .toBuffer();

    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(80);
    expect(result.analysisDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.containsAnnotations).toBe(true);
    expect(Math.min(...center)).toBeLessThan(245);
  });

  it("crops full-screen ink to the selected source instead of stretching the desktop", async () => {
    const base = await sharp({
      create: { width: 120, height: 80, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const overlay = await sharp({
      create: { width: 120, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="120" height="80"><path d="M5 5 L25 5" stroke="#ff0000" stroke-width="6"/><path d="M35 40 L85 40" stroke="#0088ff" stroke-width="6"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const ink: WhiteboardInkContext = {
      ...inkContext(`data:image/png;base64,${overlay.toString("base64")}`),
      canvas: {
        width: 120,
        height: 80,
        sourceRect: { left: 30, top: 20, width: 60, height: 40 },
      },
    };

    const result = await contextWithWhiteboardInk(
      preparedContext(`data:image/png;base64,${base.toString("base64")}`),
      ink,
    );
    const preview = Buffer.from(result.previewDataUrl.split(",")[1] ?? "", "base64");
    const center = await sharp(preview)
      .extract({ left: 58, top: 38, width: 4, height: 4 })
      .removeAlpha()
      .raw()
      .toBuffer();
    const corner = await sharp(preview)
      .extract({ left: 2, top: 2, width: 4, height: 4 })
      .removeAlpha()
      .raw()
      .toBuffer();

    expect(center[2]).toBeGreaterThan(center[0] ?? 0);
    expect(Math.min(...corner)).toBeGreaterThan(245);
  });

  it("describes a bounded coordinate sample for the model", () => {
    const points = Array.from({ length: 100 }, (_, index) => ({
      x: index * 10,
      y: 500,
      pressure: 0.5,
    }));
    const description = describeWhiteboardInk({
      ...inkContext("data:image/png;base64,AA=="),
      strokes: [
        {
          id: "stroke-1",
          tool: "pen",
          color: "#52b8e8",
          width: 3.4,
          points,
        },
      ],
    });

    expect(description).toContain("0-1000");
    expect(description).toContain("entire lesson screen");
    expect(description).toContain("stroke");
    expect(description.match(/p0\.50/g)?.length).toBe(18);
    expect(description).toContain("instead of covering the source");
  });
});

function preparedContext(previewDataUrl: string): PreparedContext {
  return {
    captureId: "capture-1",
    previewDataUrl,
    regions: [],
    pixelWidth: 120,
    pixelHeight: 80,
    capturePixelWidth: 120,
    capturePixelHeight: 80,
    display: {
      id: 1,
      label: "Test display",
      bounds: { x: 0, y: 0, width: 120, height: 80 },
      workArea: { x: 0, y: 0, width: 120, height: 80 },
      size: { width: 120, height: 80 },
      scaleFactor: 1,
    },
    cropBounds: { x: 0, y: 0, width: 120, height: 80 },
    containsAnnotations: false,
    scope: "selection",
  };
}

function inkContext(imageDataUrl: string): WhiteboardInkContext {
  return {
    imageDataUrl,
    coordinateSpace: "screen",
    canvas: {
      width: 60,
      height: 40,
      sourceRect: { left: 0, top: 0, width: 60, height: 40 },
    },
    strokes: [
      {
        id: "stroke-1",
        tool: "pen",
        color: "#52b8e8",
        width: 3.4,
        points: [
          { x: 100, y: 500, pressure: 0.5 },
          { x: 900, y: 500, pressure: 0.5 },
        ],
      },
    ],
  };
}
