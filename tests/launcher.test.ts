import { describe, expect, it } from "vitest";
import { launcherActivityVisual, launcherSize } from "../src/shared/launcher";

describe("dynamic island geometry", () => {
  it("keeps every launcher mode tightly fitted to its visible surface", () => {
    expect(launcherSize("idle")).toEqual({ width: 104, height: 38 });
    expect(launcherSize("revealed")).toEqual({ width: 260, height: 44 });
    expect(launcherSize("thinking")).toEqual({ width: 280, height: 48 });
    for (const mode of ["capturing", "teaching", "waiting", "checking", "complete"] as const) {
      expect(launcherSize(mode)).toEqual({ width: 296, height: 48 });
    }
    expect(launcherSize("transcribing")).toEqual({ width: 286, height: 48 });
    expect(launcherSize("listening")).toEqual({ width: 300, height: 50 });
    expect(launcherSize("speaking")).toEqual({ width: 300, height: 50 });
    expect(launcherSize("question")).toEqual({ width: 412, height: 168 });
  });

  it("separates live input, progress, and spoken-output visuals", () => {
    expect(launcherActivityVisual("listening")).toBe("input-waveform");
    expect(launcherActivityVisual("transcribing")).toBe("progress");
    expect(launcherActivityVisual("thinking")).toBe("progress");
    expect(launcherActivityVisual("capturing")).toBe("progress");
    expect(launcherActivityVisual("checking")).toBe("progress");
    expect(launcherActivityVisual("waiting")).toBe("none");
    expect(launcherActivityVisual("speaking")).toBe("output-waveform");
    expect(launcherActivityVisual("question")).toBe("none");
  });
});
