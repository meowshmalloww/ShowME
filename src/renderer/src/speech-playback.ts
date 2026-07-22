const DEFAULT_SYSTEM_CHUNK_LIMIT = 140;
const CJK_SYSTEM_CHUNK_LIMIT = 80;

export function splitSpokenText(
  value: string,
  maximumLength = DEFAULT_SYSTEM_CHUNK_LIMIT,
): string[] {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const limit = Math.max(
    40,
    Math.min(
      maximumLength,
      /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(text)
        ? CJK_SYSTEM_CHUNK_LIMIT
        : maximumLength,
    ),
  );
  const sentences = text.match(/[^.!?。！？;；:：]+[.!?。！？;；:：]?/gu) ?? [text];
  const chunks: string[] = [];
  let current = "";

  const push = (part: string): void => {
    const trimmed = part.trim();
    if (!trimmed) return;
    if (!current) {
      current = trimmed;
      return;
    }
    if (current.length + 1 + trimmed.length <= limit) {
      current += ` ${trimmed}`;
      return;
    }
    chunks.push(current);
    current = trimmed;
  };

  for (const sentence of sentences) {
    let remaining = sentence.trim();
    while (remaining.length > limit) {
      const minimumBreak = Math.floor(limit * 0.55);
      let breakAt = -1;
      for (const separator of [" ", ",", "，", "、"]) {
        const candidate = remaining.lastIndexOf(separator, limit);
        if (candidate >= minimumBreak) breakAt = Math.max(breakAt, candidate + 1);
      }
      if (breakAt < minimumBreak) breakAt = limit;
      push(remaining.slice(0, breakAt));
      if (current) {
        chunks.push(current);
        current = "";
      }
      remaining = remaining.slice(breakAt).trim();
    }
    push(remaining);
  }
  if (current) chunks.push(current);
  return chunks;
}

export function systemSpeechTimeoutMs(text: string, rate: number): number {
  const estimatedMs = (text.length / (11 * Math.max(0.7, rate))) * 1_000;
  return clamp(Math.ceil(estimatedMs + 9_000), 12_000, 45_000);
}

export function cloudPlaybackTimeoutMs(text: string, rate: number): number {
  const estimatedMs = (text.length / (12 * Math.max(0.7, rate))) * 1_000;
  return clamp(Math.ceil(estimatedMs + 18_000), 25_000, 120_000);
}

export function isPlayableAudioPayload(mimeType: string, byteLength: number): boolean {
  return mimeType.toLowerCase().startsWith("audio/") && byteLength >= 64;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function delayWithSignal(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = (): void => {
      globalThis.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(createAbortError());
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

interface SystemUtterancePlaybackOptions {
  synthesis: SpeechSynthesis;
  utterance: SpeechSynthesisUtterance;
  signal: AbortSignal;
  startTimeoutMs?: number;
  completionTimeoutMs: number;
}

export function playSystemUtterance({
  synthesis,
  utterance,
  signal,
  startTimeoutMs = 4_000,
  completionTimeoutMs,
}: SystemUtterancePlaybackOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    let settled = false;
    let started = false;
    let startTimer: ReturnType<typeof setTimeout>;
    let completionTimer: ReturnType<typeof setTimeout>;
    let startPoll: ReturnType<typeof setInterval>;

    const cleanup = (): void => {
      globalThis.clearTimeout(startTimer);
      globalThis.clearTimeout(completionTimer);
      globalThis.clearInterval(startPoll);
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const succeed = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const markStarted = (): void => {
      if (started) return;
      started = true;
      globalThis.clearTimeout(startTimer);
    };
    const abort = (): void => {
      cleanup();
      synthesis.cancel();
      if (!settled) {
        settled = true;
        reject(createAbortError());
      }
    };

    utterance.onstart = markStarted;
    utterance.onend = succeed;
    utterance.onerror = (event) => {
      if (signal.aborted || event.error === "canceled" || event.error === "interrupted") {
        fail(createAbortError());
        return;
      }
      fail(new Error(`Local speech failed: ${event.error || "unknown error"}.`));
    };
    signal.addEventListener("abort", abort, { once: true });
    startTimer = globalThis.setTimeout(
      () => fail(new Error("Local speech did not start in time.")),
      startTimeoutMs,
    );
    completionTimer = globalThis.setTimeout(
      () => fail(new Error("Local speech did not finish in time.")),
      completionTimeoutMs,
    );
    startPoll = globalThis.setInterval(() => {
      if (synthesis.speaking) markStarted();
      if (synthesis.paused) synthesis.resume();
    }, 250);

    try {
      synthesis.speak(utterance);
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Local speech could not start."));
    }
  });
}

interface AudioElementPlaybackOptions {
  audio: HTMLAudioElement;
  signal: AbortSignal;
  startTimeoutMs?: number;
  completionTimeoutMs: number;
  stallTimeoutMs?: number;
}

export function playAudioElement({
  audio,
  signal,
  startTimeoutMs = 6_000,
  completionTimeoutMs,
  stallTimeoutMs = 6_000,
}: AudioElementPlaybackOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError());
      return;
    }
    let settled = false;
    let started = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = globalThis.setTimeout(
      () => fail(new Error("Narration audio did not start in time.")),
      startTimeoutMs,
    );
    const completionTimer = globalThis.setTimeout(
      () => fail(new Error("Narration audio did not finish in time.")),
      completionTimeoutMs,
    );

    function cleanup(): void {
      globalThis.clearTimeout(startTimer);
      globalThis.clearTimeout(completionTimer);
      if (stallTimer !== undefined) globalThis.clearTimeout(stallTimer);
      audio.removeEventListener("playing", markStarted);
      audio.removeEventListener("canplay", clearStall);
      audio.removeEventListener("timeupdate", clearStall);
      audio.removeEventListener("waiting", waitForRecovery);
      audio.removeEventListener("stalled", waitForRecovery);
      audio.removeEventListener("ended", succeed);
      audio.removeEventListener("error", mediaFailed);
      signal.removeEventListener("abort", abort);
    }
    function succeed(): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }
    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }
    function markStarted(): void {
      started = true;
      globalThis.clearTimeout(startTimer);
      clearStall();
    }
    function clearStall(): void {
      if (stallTimer !== undefined) globalThis.clearTimeout(stallTimer);
      stallTimer = undefined;
    }
    function waitForRecovery(): void {
      if (!started || stallTimer !== undefined) return;
      stallTimer = globalThis.setTimeout(
        () => fail(new Error("Narration audio stalled during playback.")),
        stallTimeoutMs,
      );
    }
    function mediaFailed(): void {
      const code = audio.error?.code;
      fail(
        new Error(`Narration audio could not be decoded${code ? ` (media error ${code})` : ""}.`),
      );
    }
    function abort(): void {
      audio.pause();
      fail(createAbortError());
    }

    audio.addEventListener("playing", markStarted);
    audio.addEventListener("canplay", clearStall);
    audio.addEventListener("timeupdate", clearStall);
    audio.addEventListener("waiting", waitForRecovery);
    audio.addEventListener("stalled", waitForRecovery);
    audio.addEventListener("ended", succeed);
    audio.addEventListener("error", mediaFailed);
    signal.addEventListener("abort", abort, { once: true });

    try {
      void audio.play().then(markStarted, (error: unknown) => {
        fail(error instanceof Error ? error : new Error("Narration audio could not start."));
      });
    } catch (error) {
      fail(error instanceof Error ? error : new Error("Narration audio could not start."));
    }
  });
}

function createAbortError(): Error {
  const error = new Error("Narration was stopped.");
  error.name = "AbortError";
  return error;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
