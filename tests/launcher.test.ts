import { describe, expect, it } from "vitest";
import { launcherSize } from "../src/shared/launcher";

describe("top-edge launcher geometry", () => {
  it("keeps every launcher mode tightly fitted to its visible surface", () => {
    expect(launcherSize("idle")).toEqual({ width: 56, height: 8 });
    expect(launcherSize("revealed")).toEqual({ width: 236, height: 40 });
    expect(launcherSize("thinking")).toEqual({ width: 260, height: 46 });
    expect(launcherSize("transcribing")).toEqual({ width: 264, height: 46 });
    expect(launcherSize("listening")).toEqual({ width: 280, height: 50 });
    expect(launcherSize("speaking")).toEqual({ width: 280, height: 50 });
    expect(launcherSize("question")).toEqual({ width: 400, height: 176 });
  });
});
