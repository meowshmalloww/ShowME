import { describe, expect, it } from "vitest";
import { downsampleToPcm16, floatRmsLevel } from "../src/shared/audio";

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
});
