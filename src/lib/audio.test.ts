/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { speakNarration, stopNarration } from "./audio";

class TestUtterance extends EventTarget {
  rate = 1;

  constructor(readonly text: string) {
    super();
  }
}

function installSpeechSynthesis() {
  let active: TestUtterance | undefined;
  const speech = {
    speak: vi.fn((utterance: TestUtterance) => {
      active = utterance;
    }),
    cancel: vi.fn(),
  };
  vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: speech,
  });
  return { speech, active: () => active };
}

afterEach(() => {
  stopNarration();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("narration lifecycle", () => {
  it("stays active until system speech reports completion", async () => {
    const harness = installSpeechSynthesis();
    let completed = false;
    const narration = speakNarration("Visible explanation", "nova", 1, false).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(harness.speech.speak).toHaveBeenCalledOnce();
    expect(completed).toBe(false);

    harness.active()?.dispatchEvent(new Event("end"));
    await narration;
    expect(completed).toBe(true);
  });

  it("cancels and resolves active system narration", async () => {
    const harness = installSpeechSynthesis();
    const narration = speakNarration("Stop this explanation", "nova", 1, false);
    harness.speech.cancel.mockClear();

    stopNarration();

    await expect(narration).resolves.toBeUndefined();
    expect(harness.speech.cancel).toHaveBeenCalledOnce();
  });
});
