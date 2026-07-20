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

  constructor(sampleRate = 16_000, preRollMs = 360, endSilenceMs = 560, maxDurationMs = 3_000) {
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
