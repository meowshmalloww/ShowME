import { describe, expect, it } from "vitest";
import {
  boundsToPixels,
  clientToNormalized,
  combinedBounds,
  snapNormalizedPoint,
} from "../src/shared/coordinates";

describe("normalized display geometry", () => {
  it("keeps logical selection coordinates independent of DPI", () => {
    expect(clientToNormalized({ x: 960, y: 540 }, 1920, 1080)).toEqual({ x: 500, y: 500 });
    expect(boundsToPixels({ x: 250, y: 250, width: 500, height: 500 }, 3840, 2160)).toEqual({
      x: 960,
      y: 540,
      width: 1920,
      height: 1080,
    });
  });

  it("combines multiple selected areas with bounded padding", () => {
    expect(
      combinedBounds(
        [
          {
            id: "a",
            kind: "rectangle",
            points: [
              { x: 100, y: 200 },
              { x: 300, y: 400 },
            ],
          },
          {
            id: "b",
            kind: "circle",
            points: [
              { x: 600, y: 500 },
              { x: 800, y: 900 },
            ],
          },
        ],
        10,
      ),
    ).toEqual({ x: 90, y: 190, width: 720, height: 720 });
  });

  it("snaps annotation arrows in physical viewport space", () => {
    const point = snapNormalizedPoint({ x: 500, y: 500 }, { x: 730, y: 620 }, 1600, 900, 45);
    expect(point.x).toBeGreaterThan(700);
    expect(point.y).toBe(500);
  });
});
