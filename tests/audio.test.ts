import { describe, expect, it } from "vitest";
import {
  calibratedSpeechThreshold,
  downsampleToPcm16,
  findSystemVoice,
  floatRmsLevel,
  frequencySpectrumLevels,
  VoiceEndpointDetector,
  WakeUtteranceCollector,
} from "../src/shared/audio";

describe("local narration voice selection", () => {
  const voices = [
    { voiceURI: "voice-one", name: "Voice One", lang: "en-US", localService: true },
    { voiceURI: "voice-two", name: "Voice Two", lang: "en-GB", localService: true },
  ];

  it("uses the exact local voice selected in settings", () => {
    expect(findSystemVoice(voices, "voice-two")?.name).toBe("Voice Two");
    expect(findSystemVoice(voices, "Voice One")?.voiceURI).toBe("voice-one");
  });

  it("leaves selection to the operating system for the default or a missing voice", () => {
    expect(findSystemVoice(voices, "default")).toBeUndefined();
    expect(findSystemVoice(voices, "missing")).toBeUndefined();
  });
});

describe("voice question endpointing", () => {
  it("finishes promptly after a real utterance and a 1.2 second pause", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    let now = 0;
    for (let frame = 0; frame < 12; frame += 1) {
      expect(endpoint.push(0.08, now)).toBe("continue");
      now += 32;
    }
    expect(endpoint.hasHeardSpeech()).toBe(true);
    let decision = endpoint.push(0.004, now);
    while (decision === "continue" && now < 2_500) {
      now += 32;
      decision = endpoint.push(0.004, now);
    }
    expect(decision).toBe("finish-silence");
    expect(now).toBeLessThan(1_700);
  });

  it("does not let steady room noise keep the recorder open", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    let now = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      endpoint.push(0.08, now);
      now += 32;
    }
    let decision = endpoint.push(0.02, now);
    while (decision === "continue" && now < 3_000) {
      now += 32;
      decision = endpoint.push(0.02, now);
    }
    expect(decision).toBe("finish-silence");
    expect(now).toBeLessThan(1_900);
  });

  it("allows a short natural pause and waits longer for initial speech", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    expect(endpoint.push(0, 0)).toBe("continue");
    expect(endpoint.push(0, 1_500)).toBe("continue");
    for (const now of [1_600, 1_632, 1_664, 1_696]) endpoint.push(0.07, now);
    expect(endpoint.hasHeardSpeech()).toBe(true);
    expect(endpoint.push(0.003, 2_500)).toBe("continue");
    expect(endpoint.push(0.07, 2_600)).toBe("continue");
    expect(endpoint.push(0.003, 3_700)).toBe("continue");
    expect(endpoint.push(0.003, 3_801)).toBe("finish-silence");
  });

  it("stops an empty recording after the separate no-speech timeout", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    expect(endpoint.push(0.003, 0)).toBe("continue");
    expect(endpoint.push(0.003, 3_999)).toBe("continue");
    expect(endpoint.push(0.003, 4_000)).toBe("finish-no-speech");
    expect(endpoint.hasHeardSpeech()).toBe(false);
  });

  it("accepts quiet AirPods speech at the same floor used by wake listening", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    for (const now of [0, 32, 64, 96]) endpoint.push(0.007, now);
    expect(endpoint.hasHeardSpeech()).toBe(true);
  });

  it("does not classify steady energy below the calibrated floor as speech", () => {
    const endpoint = new VoiceEndpointDetector(1_200, 45_000);
    for (let now = 0; now <= 3_500; now += 32) endpoint.push(0.005, now);
    expect(endpoint.hasHeardSpeech()).toBe(false);
  });
});

describe("wake microphone PCM conversion", () => {
  it("downsamples browser audio to the 16 kHz mono PCM expected by Windows speech", () => {
    const source = new Float32Array(4_800);
    source.fill(0.5);
    const pcm = downsampleToPcm16(source, 48_000);
    expect(pcm).toHaveLength(1_600);
    expect(pcm[0]).toBeCloseTo(16_384, -1);
    expect(pcm.at(-1)).toBeCloseTo(16_384, -1);
  });

  it("clamps input and reports a bounded silence/signal distinction", () => {
    expect(Array.from(downsampleToPcm16(new Float32Array([-2, 2]), 16_000))).toEqual([
      -32_768, 32_767,
    ]);
    expect(floatRmsLevel(new Float32Array(32))).toBe(0);
    expect(floatRmsLevel(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });

  it("calibrates speech above the measured room noise without becoming too insensitive", () => {
    expect(calibratedSpeechThreshold(Number.POSITIVE_INFINITY)).toBe(0.0055);
    expect(calibratedSpeechThreshold(0.004)).toBe(0.0055);
    expect(calibratedSpeechThreshold(0.0054)).toBeCloseTo(0.00729, 5);
  });

  it("turns live frequency bins into bounded visual spectrum bars", () => {
    const silence = frequencySpectrumLevels(new Uint8Array(128), 12);
    expect(silence).toEqual(new Array(12).fill(0.05));
    const bins = new Uint8Array(128);
    bins.fill(210, 2, 24);
    const speech = frequencySpectrumLevels(bins, 12);
    expect(speech).toHaveLength(12);
    expect(Math.max(...speech)).toBeGreaterThan(0.7);
    expect(speech.every((level) => level >= 0.05 && level <= 1)).toBe(true);
  });

  it("sends one bounded utterance with pre-roll after speech ends", () => {
    const collector = new WakeUtteranceCollector(1_000, 200, 300, 1_500);
    expect(collector.push(new Int16Array(100).fill(1), false)).toBeNull();
    expect(collector.push(new Int16Array(100).fill(2), true)).toBeNull();
    expect(collector.push(new Int16Array(200).fill(3), true)).toBeNull();
    expect(collector.push(new Int16Array(300).fill(4), false)).toEqual(
      new Int16Array([
        ...new Int16Array(100).fill(1),
        ...new Int16Array(100).fill(2),
        ...new Int16Array(200).fill(3),
        ...new Int16Array(300).fill(4),
      ]),
    );
    expect(collector.isActive()).toBe(false);
  });

  it("releases the default wake phrase after 360 ms of silence", () => {
    const collector = new WakeUtteranceCollector(1_000);
    expect(collector.push(new Int16Array(120).fill(1), true)).toBeNull();
    expect(collector.push(new Int16Array(180), false)).toBeNull();
    expect(collector.push(new Int16Array(180), false)).not.toBeNull();
  });
});
