import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { reconcileVoiceRoutes } from "../src/shared/voice";

describe("voice provider selection", () => {
  it("uses an independently configured speech service when the selected input lacks a key", () => {
    const routed = reconcileVoiceRoutes(
      { ...DEFAULT_SETTINGS, voiceInputProvider: "deepgram" },
      { deepgram: false, elevenlabs: true },
    );
    expect(routed.voiceInputProvider).toBe("elevenlabs");
  });

  it("never replaces the zero-cost local narration route just because a cloud key exists", () => {
    const routed = reconcileVoiceRoutes(DEFAULT_SETTINGS, { deepgram: true, elevenlabs: true });
    expect(routed.voiceOutputProvider).toBe("system");
  });

  it("moves an unavailable cloud narration route to another configured service", () => {
    const routed = reconcileVoiceRoutes(
      { ...DEFAULT_SETTINGS, voiceOutputProvider: "deepgram" },
      { deepgram: false, elevenlabs: true },
    );
    expect(routed.voiceOutputProvider).toBe("elevenlabs");
  });
});
