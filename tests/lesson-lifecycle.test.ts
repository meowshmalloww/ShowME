import { describe, expect, it } from "vitest";
import {
  lessonBoardFadeMs,
  lessonBoardHoldMs,
  silentStepDurationMs,
} from "../src/shared/lesson-lifecycle";

describe("whiteboard lifecycle", () => {
  it("keeps completed ink readable, then retires within a bounded time", () => {
    expect(lessonBoardHoldMs(1)).toBeGreaterThanOrEqual(24_000);
    expect(lessonBoardHoldMs(18)).toBeLessThanOrEqual(40_000);
  });

  it("uses a graceful fade and bounds silent visual pacing", () => {
    expect(lessonBoardFadeMs(false)).toBe(900);
    expect(lessonBoardFadeMs(true)).toBe(120);
    expect(silentStepDurationMs(50)).toBe(900);
    expect(silentStepDurationMs(60_000)).toBe(4_000);
  });
});
