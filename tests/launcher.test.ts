import { describe, expect, it } from "vitest";
import { launcherActivityVisual, launcherSize } from "../src/shared/launcher";

describe("top-edge launcher geometry", () => {
  it("keeps every launcher mode tightly fitted to its visible surface", () => {
    expect(launcherSize("idle")).toEqual({ width: 56, height: 8 });
    expect(launcherSize("revealed")).toEqual({ width: 236, height: 40 });
    expect(launcherSize("thinking")).toEqual({ width: 252, height: 44 });
    expect(launcherSize("transcribing")).toEqual({ width: 258, height: 44 });
    expect(launcherSize("listening")).toEqual({ width: 272, height: 46 });
    expect(launcherSize("speaking")).toEqual({ width: 272, height: 46 });
    expect(launcherSize("question")).toEqual({ width: 388, height: 160 });
  });

  it("separates live input, progress, and spoken-output visuals", () => {
    expect(launcherActivityVisual("listening")).toBe("input-waveform");
    expect(launcherActivityVisual("transcribing")).toBe("progress");
    expect(launcherActivityVisual("thinking")).toBe("progress");
    expect(launcherActivityVisual("speaking")).toBe("output-waveform");
    expect(launcherActivityVisual("question")).toBe("none");
  });
});
