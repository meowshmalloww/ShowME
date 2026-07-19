import { describe, expect, it } from "vitest";
import { normalizeWakeLevel } from "../src/main/wake-word";

describe("wake-word microphone level", () => {
  it("amplifies ordinary speech while keeping the meter bounded", () => {
    expect(normalizeWakeLevel(-20)).toBe(0);
    expect(normalizeWakeLevel(4)).toBeCloseTo(0.2);
    expect(normalizeWakeLevel(25)).toBeCloseTo(0.5);
    expect(normalizeWakeLevel(100)).toBe(1);
    expect(normalizeWakeLevel(180)).toBe(1);
  });
});
