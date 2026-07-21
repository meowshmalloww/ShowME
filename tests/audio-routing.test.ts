import { describe, expect, it, vi } from "vitest";
import { routeAudioOutput } from "../src/renderer/src/audio";

describe("speaker routing", () => {
  it("uses the system default without requiring setSinkId", async () => {
    const audio = document.createElement("audio");
    await expect(routeAudioOutput(audio, "default")).resolves.toBe(true);
  });

  it("routes playback to the configured output when it still exists", async () => {
    const audio = document.createElement("audio") as HTMLAudioElement & {
      setSinkId: ReturnType<typeof vi.fn>;
    };
    audio.setSinkId = vi.fn().mockResolvedValue(undefined);

    await expect(routeAudioOutput(audio, "speaker-2")).resolves.toBe(true);
    expect(audio.setSinkId).toHaveBeenCalledWith("speaker-2");
  });

  it("falls back to the system default when a saved speaker disappears", async () => {
    const audio = document.createElement("audio") as HTMLAudioElement & {
      setSinkId: ReturnType<typeof vi.fn>;
    };
    audio.setSinkId = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Missing", "NotFoundError"))
      .mockResolvedValueOnce(undefined);

    await expect(routeAudioOutput(audio, "missing-speaker")).resolves.toBe(false);
    expect(audio.setSinkId).toHaveBeenNthCalledWith(1, "missing-speaker");
    expect(audio.setSinkId).toHaveBeenNthCalledWith(2, "default");
  });
});
