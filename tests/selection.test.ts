import { describe, expect, it } from "vitest";
import { finalizeLasso } from "../src/shared/selection";
import type { SelectionRegion } from "../src/shared/types";

describe("lasso finalization", () => {
  it("preserves a genuine freeform selection", () => {
    const region: SelectionRegion = {
      id: "freeform",
      kind: "lasso",
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
      ],
    };

    expect(finalizeLasso(region, { x: 100, y: 200 }).points).toEqual([
      ...region.points,
      { x: 100, y: 200 },
    ]);
  });

  it("turns a fast straight gesture into a visible narrow selection", () => {
    const region: SelectionRegion = {
      id: "stroke",
      kind: "lasso",
      points: [{ x: 100, y: 100 }],
    };

    const result = finalizeLasso(region, { x: 240, y: 180 });
    expect(result.points).toHaveLength(4);
    expect(new Set(result.points.map((point) => point.y)).size).toBeGreaterThan(1);
  });
});
