import { describe, expect, it } from "vitest";
import {
  boundsToPixels,
  clientToNormalized,
  combinedBounds,
  normalizedToClient,
} from "./coordinates";
import type { SelectionRegion } from "./types";

describe("coordinate conversion", () => {
  it("round-trips physical viewport coordinates through the normalized scene space", () => {
    const normalized = clientToNormalized({ x: 960, y: 540 }, 1920, 1080);
    expect(normalized).toEqual({ x: 500, y: 500 });
    expect(normalizedToClient(normalized, 1920, 1080)).toEqual({ x: 960, y: 540 });
  });

  it("clamps selections and converts union bounds to physical pixels", () => {
    const regions: SelectionRegion[] = [
      {
        id: "left",
        kind: "rectangle",
        points: [
          { x: 10, y: 20 },
          { x: 500, y: 600 },
        ],
      },
      {
        id: "right",
        kind: "point",
        points: [{ x: 990, y: 980 }],
      },
    ];
    const bounds = combinedBounds(regions, 20);
    expect(bounds).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(boundsToPixels(bounds, 2560, 1440)).toEqual({
      x: 0,
      y: 0,
      width: 2560,
      height: 1440,
    });
  });

  it("rejects zero-sized viewports", () => {
    expect(() => clientToNormalized({ x: 1, y: 1 }, 0, 100)).toThrow(
      "Viewport dimensions must be positive",
    );
  });
});
