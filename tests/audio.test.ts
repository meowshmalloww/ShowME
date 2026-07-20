import { describe, expect, it } from "vitest";
import {
  calibratedSpeechThreshold,
  downsampleToPcm16,
  floatRmsLevel,
  WakeUtteranceCollector,
} from "../src/shared/audio";

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
