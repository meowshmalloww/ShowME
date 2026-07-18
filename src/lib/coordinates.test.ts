import { describe, expect, it } from "vitest";
import {
  arrowGeometry,
  boundsToPixels,
  clientToNormalized,
  combinedBounds,
  normalizedToClient,
  snapNormalizedPoint,
  squareNormalizedPoint,
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

  it("snaps lines using screen-space angles instead of distorted normalized angles", () => {
    const snapped = snapNormalizedPoint({ x: 100, y: 100 }, { x: 500, y: 780 }, 1600, 900);
    const start = normalizedToClient({ x: 100, y: 100 }, 1600, 900);
    const end = normalizedToClient(snapped, 1600, 900);
    const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
    expect(angle).toBeCloseTo(45, 6);
  });

  it("constrains rectangles to a square in screen space", () => {
    const constrained = squareNormalizedPoint({ x: 100, y: 100 }, { x: 300, y: 500 }, 1600, 900);
    const start = normalizedToClient({ x: 100, y: 100 }, 1600, 900);
    const end = normalizedToClient(constrained, 1600, 900);
    expect(Math.abs(end.x - start.x)).toBeCloseTo(Math.abs(end.y - start.y), 6);
  });

  it("keeps an arrowhead aligned with the actual drag vector and clear of the shaft", () => {
    const geometry = arrowGeometry({ x: 20, y: 30 }, { x: 220, y: 130 }, 3);
    expect(geometry).toBeDefined();
    expect(geometry?.angleDegrees).toBeCloseTo(-26.565, 2);
    expect(geometry?.shaftEnd.x).toBeLessThan(220);
    expect(geometry?.left).not.toEqual(geometry?.right);
    expect(arrowGeometry({ x: 1, y: 1 }, { x: 1.5, y: 1.5 })).toBeUndefined();
  });
});
