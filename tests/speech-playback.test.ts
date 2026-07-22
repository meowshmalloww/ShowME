import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cloudPlaybackTimeoutMs,
  isPlayableAudioPayload,
  playAudioElement,
  playSystemUtterance,
  splitSpokenText,
  systemSpeechTimeoutMs,
} from "../src/renderer/src/speech-playback";

describe("narration playback resilience", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("splits long narration into short sentence-aware Windows speech segments", () => {
    const chunks = splitSpokenText(
      "First identify the opposite side. Then identify the adjacent side. Now divide 11.9 by 10 and use inverse tangent to find the angle.",
      64,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 64)).toBe(true);
    expect(chunks.join(" ")).toContain("inverse tangent");
  });

  it("uses shorter chunks for CJK narration", () => {
    const chunks = splitSpokenText("这是一个需要逐步解释的很长句子。".repeat(10));
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(80);
  });

  it("bounds completion watchdogs so neither local nor cloud narration waits forever", () => {
    expect(systemSpeechTimeoutMs("short", 1)).toBe(12_000);
    expect(systemSpeechTimeoutMs("x".repeat(10_000), 0.7)).toBe(45_000);
    expect(cloudPlaybackTimeoutMs("short", 1)).toBe(25_000);
    expect(cloudPlaybackTimeoutMs("x".repeat(20_000), 0.7)).toBe(120_000);
  });

  it("waits for actual system speech start and completion", async () => {
    const utterance = fakeUtterance();
    const synthesis = fakeSynthesis((value) => {
      value.onstart?.(new Event("start") as SpeechSynthesisEvent);
      value.onend?.(new Event("end") as SpeechSynthesisEvent);
    });

    await expect(
      playSystemUtterance({
        synthesis,
        utterance,
        signal: new AbortController().signal,
        completionTimeoutMs: 12_000,
      }),
    ).resolves.toBeUndefined();
    expect(synthesis.speak).toHaveBeenCalledWith(utterance);
  });

  it("rejects a local utterance that never starts", async () => {
    vi.useFakeTimers();
    const utterance = fakeUtterance();
    const synthesis = fakeSynthesis(() => undefined);
    const playback = playSystemUtterance({
      synthesis,
      utterance,
      signal: new AbortController().signal,
      startTimeoutMs: 400,
      completionTimeoutMs: 2_000,
    });
    const result = expect(playback).rejects.toThrow("did not start");

    await vi.advanceTimersByTimeAsync(400);
    await result;
  });

  it("cancels a system utterance immediately when a lesson is stopped", async () => {
    const controller = new AbortController();
    const utterance = fakeUtterance();
    const synthesis = fakeSynthesis(() => undefined);
    const playback = playSystemUtterance({
      synthesis,
      utterance,
      signal: controller.signal,
      completionTimeoutMs: 12_000,
    });
    const result = expect(playback).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();
    await result;
    expect(synthesis.cancel).toHaveBeenCalled();
  });

  it("resolves cloud audio only after playback ends", async () => {
    const audio = document.createElement("audio");
    vi.spyOn(audio, "play").mockResolvedValue(undefined);
    const playback = playAudioElement({
      audio,
      signal: new AbortController().signal,
      completionTimeoutMs: 25_000,
    });

    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("ended"));
    await expect(playback).resolves.toBeUndefined();
  });

  it("does not mistake a browser resource abort event for stopped narration", async () => {
    const audio = document.createElement("audio");
    vi.spyOn(audio, "play").mockResolvedValue(undefined);
    const playback = playAudioElement({
      audio,
      signal: new AbortController().signal,
      completionTimeoutMs: 25_000,
    });

    // Chromium can emit this when its media loader is replaced or rerouted. Actual lesson
    // cancellation is carried by the AbortSignal, while decode/stall watchdogs cover failures.
    audio.dispatchEvent(new Event("abort"));
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("ended"));

    await expect(playback).resolves.toBeUndefined();
  });

  it("rejects cloud audio that remains stalled", async () => {
    vi.useFakeTimers();
    const audio = document.createElement("audio");
    vi.spyOn(audio, "play").mockResolvedValue(undefined);
    const playback = playAudioElement({
      audio,
      signal: new AbortController().signal,
      completionTimeoutMs: 25_000,
      stallTimeoutMs: 500,
    });
    const result = expect(playback).rejects.toThrow("stalled");

    audio.dispatchEvent(new Event("playing"));
    await Promise.resolve();
    audio.dispatchEvent(new Event("waiting"));
    await vi.advanceTimersByTimeAsync(500);
    await result;
  });

  it("accepts only nontrivial audio payloads", () => {
    expect(isPlayableAudioPayload("audio/mpeg", 128)).toBe(true);
    expect(isPlayableAudioPayload("application/json", 128)).toBe(false);
    expect(isPlayableAudioPayload("audio/mpeg", 3)).toBe(false);
  });
});

function fakeUtterance(): SpeechSynthesisUtterance {
  return {
    onstart: null,
    onend: null,
    onerror: null,
  } as unknown as SpeechSynthesisUtterance;
}

function fakeSynthesis(
  speak: (utterance: SpeechSynthesisUtterance) => void,
): SpeechSynthesis & { speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> } {
  return {
    speaking: false,
    paused: false,
    speak: vi.fn(speak),
    cancel: vi.fn(),
    resume: vi.fn(),
  } as unknown as SpeechSynthesis & {
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
}
