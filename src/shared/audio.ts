export function floatRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let energy = 0;
  for (const sample of samples) energy += sample * sample;
  return Math.sqrt(energy / samples.length);
}

export function calibratedSpeechThreshold(noiseFloor: number): number {
  const boundedFloor = Number.isFinite(noiseFloor) ? Math.max(0, noiseFloor) : 0.004;
  return Math.max(0.0055, boundedFloor * 1.35);
}

export type VoiceEndpointDecision =
  | "continue"
  | "finish-silence"
  | "finish-no-speech"
  | "finish-limit";

/**
 * Lightweight voice endpointing for the recorded question. It uses a short speech-onset
 * confirmation, an adaptive room-noise estimate, and a decaying peak envelope so steady fan or
 * microphone noise cannot keep the recorder open indefinitely.
 */
export class VoiceEndpointDetector {
  private readonly noSpeechMs: number;
  private startedAt: number | null = null;
  private lastSpeechAt = 0;
  private noiseFloor = 0.004;
  private peakEnvelope = 0;
  private speechFrames = 0;
  private heardSpeech = false;

  constructor(
    private readonly silenceMs: number,
    private readonly maxDurationMs: number,
    noSpeechMs = Math.max(4_000, silenceMs * 2),
  ) {
    this.noSpeechMs = noSpeechMs;
  }

  hasHeardSpeech(): boolean {
    return this.heardSpeech;
  }

  push(rawLevel: number, nowMs: number): VoiceEndpointDecision {
    if (this.startedAt === null) this.startedAt = nowMs;
    const elapsed = nowMs - this.startedAt;
    const level = Number.isFinite(rawLevel) ? Math.max(0, rawLevel) : 0;
    this.peakEnvelope = Math.max(level, this.peakEnvelope * 0.985);

    // Use the same calibrated onset floor as wake listening. The previous 0.01 minimum could
    // recognize "ShowME" but then reject the learner's quieter question on the same microphone.
    const startThreshold = calibratedSpeechThreshold(this.noiseFloor);
    const continuationThreshold = Math.max(
      0.0045,
      this.noiseFloor * 1.35,
      Math.min(0.026, this.peakEnvelope * 0.25),
    );
    const speaking = level > (this.heardSpeech ? continuationThreshold : startThreshold);

    // Learn only from frames that are not currently classified as speech. This hysteresis keeps
    // quiet voices from being absorbed into the room-noise estimate. Sustained energy far below a
    // recent speech peak is allowed to raise the floor so a fan cannot hold the turn open forever.
    const learningCeiling = Math.max(0.028, Math.min(0.05, this.peakEnvelope * 0.45));
    const likelySteadyNoise =
      this.heardSpeech && this.peakEnvelope > 0 && level < this.peakEnvelope * 0.45;
    if ((!speaking || likelySteadyNoise) && level < learningCeiling) {
      this.noiseFloor = this.noiseFloor * 0.82 + level * 0.18;
    }

    if (!this.heardSpeech) {
      this.speechFrames = speaking ? this.speechFrames + 1 : 0;
      if (this.speechFrames >= 3) {
        this.heardSpeech = true;
        this.lastSpeechAt = nowMs;
      }
    } else if (speaking) {
      this.lastSpeechAt = nowMs;
    }

    if (elapsed >= this.maxDurationMs) return "finish-limit";
    if (this.heardSpeech && nowMs - this.lastSpeechAt >= this.silenceMs) {
      return "finish-silence";
    }
    if (!this.heardSpeech && elapsed >= this.noSpeechMs) return "finish-no-speech";
    return "continue";
  }
}

export function frequencySpectrumLevels(bins: Uint8Array, barCount = 12): number[] {
  if (barCount <= 0) return [];
  if (bins.length < 2) return Array.from({ length: barCount }, () => 0.05);
  const firstBin = 1;
  const lastBin = Math.max(firstBin + 1, Math.floor(bins.length * 0.32));
  const logStart = Math.log(firstBin);
  const logEnd = Math.log(lastBin);
  return Array.from({ length: barCount }, (_, index) => {
    const start = Math.max(
      firstBin,
      Math.floor(Math.exp(logStart + (logEnd - logStart) * (index / barCount))),
    );
    const end = Math.max(
      start + 1,
      Math.ceil(Math.exp(logStart + (logEnd - logStart) * ((index + 1) / barCount))),
    );
    let peak = 0;
    let total = 0;
    let count = 0;
    for (let bin = start; bin < Math.min(end, bins.length); bin += 1) {
      const value = bins[bin] ?? 0;
      peak = Math.max(peak, value);
      total += value;
      count += 1;
    }
    const energy = count > 0 ? peak * 0.62 + (total / count) * 0.38 : 0;
    return Math.max(0.05, Math.min(1, (energy / 255) ** 0.72));
  });
}

export interface SystemVoiceDescriptor {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}

export function findSystemVoice<T extends SystemVoiceDescriptor>(
  voices: readonly T[],
  selectedVoice: string,
): T | undefined {
  if (!selectedVoice || selectedVoice === "default") {
    return voices.find((voice) => /\b(natural|neural|online)\b/i.test(voice.name));
  }
  return voices.find((voice) => voice.voiceURI === selectedVoice || voice.name === selectedVoice);
}

export function downsampleToPcm16(
  samples: Float32Array,
  sourceRate: number,
  targetRate = 16_000,
): Int16Array {
  if (samples.length === 0 || sourceRate <= 0 || targetRate <= 0) return new Int16Array();
  const outputLength = Math.max(1, Math.floor((samples.length * targetRate) / sourceRate));
  const output = new Int16Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.min(samples.length, Math.floor((index + 1) * ratio)));
    let sum = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += samples[sourceIndex] ?? 0;
    }
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output;
}

export class WakeUtteranceCollector {
  private readonly preRollSamples: number;
  private readonly endSilenceSamples: number;
  private readonly maxSamples: number;
  private preRoll: Int16Array[] = [];
  private preRollLength = 0;
  private active: Int16Array[] = [];
  private activeLength = 0;
  private silenceLength = 0;

  constructor(sampleRate = 16_000, preRollMs = 320, endSilenceMs = 360, maxDurationMs = 2_800) {
    this.preRollSamples = Math.round((sampleRate * preRollMs) / 1000);
    this.endSilenceSamples = Math.round((sampleRate * endSilenceMs) / 1000);
    this.maxSamples = Math.round((sampleRate * maxDurationMs) / 1000);
  }

  isActive(): boolean {
    return this.activeLength > 0;
  }

  push(chunk: Int16Array, speaking: boolean): Int16Array | null {
    if (chunk.length === 0) return null;
    if (!this.isActive()) {
      this.rememberPreRoll(chunk);
      if (!speaking) return null;
      this.active = this.preRoll;
      this.activeLength = this.preRollLength;
      this.preRoll = [];
      this.preRollLength = 0;
      this.silenceLength = 0;
      return this.activeLength >= this.maxSamples ? this.finish() : null;
    }

    this.active.push(chunk);
    this.activeLength += chunk.length;
    this.silenceLength = speaking ? 0 : this.silenceLength + chunk.length;
    if (this.silenceLength >= this.endSilenceSamples || this.activeLength >= this.maxSamples) {
      return this.finish();
    }
    return null;
  }

  private rememberPreRoll(chunk: Int16Array): void {
    this.preRoll.push(chunk);
    this.preRollLength += chunk.length;
    while (this.preRollLength > this.preRollSamples && this.preRoll.length > 1) {
      const removed = this.preRoll.shift();
      if (removed) this.preRollLength -= removed.length;
    }
  }

  private finish(): Int16Array {
    const length = Math.min(this.activeLength, this.maxSamples);
    const result = new Int16Array(length);
    let offset = 0;
    for (const chunk of this.active) {
      if (offset >= length) break;
      const slice = chunk.subarray(0, length - offset);
      result.set(slice, offset);
      offset += slice.length;
    }
    this.active = [];
    this.activeLength = 0;
    this.silenceLength = 0;
    return result;
  }
}
