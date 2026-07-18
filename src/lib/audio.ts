import { desktop } from "./api";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export interface RecordingSession {
  stop: () => Promise<{ mimeType: string; base64: string }>;
  cancel: () => void;
}

export async function startRecording(): Promise<RecordingSession> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("This system WebView does not expose microphone recording.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.start(200);

  const stopTracks = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.addEventListener(
          "stop",
          async () => {
            try {
              const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
              const base64 = arrayBufferToBase64(await blob.arrayBuffer());
              stopTracks();
              resolve({ mimeType: blob.type, base64 });
            } catch (error) {
              reject(error);
            }
          },
          { once: true },
        );
        recorder.stop();
      }),
    cancel: () => {
      if (recorder.state !== "inactive") recorder.stop();
      stopTracks();
    },
  };
}

let narrationGeneration = 0;
let stopActiveNarration: (() => void) | null = null;

export function stopNarration() {
  narrationGeneration += 1;
  const stop = stopActiveNarration;
  stopActiveNarration = null;
  if (stop) stop();
  else window.speechSynthesis?.cancel();
}

export async function speakNarration(
  text: string,
  voice: string,
  speed: number,
  preferCloud: boolean,
): Promise<void> {
  stopNarration();
  const generation = narrationGeneration;
  if (!text.trim()) return;

  if (preferCloud) {
    try {
      const base64 = await desktop.synthesize(text, voice, speed);
      if (generation !== narrationGeneration) return;
      const url = URL.createObjectURL(base64ToBlob(base64, "audio/mpeg"));
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          URL.revokeObjectURL(url);
          if (stopActiveNarration === stop) stopActiveNarration = null;
          if (error) reject(error);
          else resolve();
        };
        const stop = () => {
          audio.pause();
          finish();
        };
        stopActiveNarration = stop;
        audio.addEventListener("ended", () => finish(), { once: true });
        audio.addEventListener(
          "error",
          () => finish(new Error("The narration audio could not be played.")),
          { once: true },
        );
        audio
          .play()
          .catch((error) =>
            finish(
              error instanceof Error ? error : new Error("The narration audio could not start."),
            ),
          );
      });
      return;
    } catch {
      // The explicit native speech fallback below keeps narration available offline.
      if (generation !== narrationGeneration) return;
    }
  }

  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    throw new Error("No speech output service is available on this device.");
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const utterance = new SpeechSynthesisUtterance(text);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (stopActiveNarration === stop) stopActiveNarration = null;
      if (error) reject(error);
      else resolve();
    };
    const stop = () => {
      window.speechSynthesis.cancel();
      finish();
    };
    utterance.rate = speed;
    utterance.addEventListener("end", () => finish(), { once: true });
    utterance.addEventListener(
      "error",
      (event) => {
        const failure = event as SpeechSynthesisErrorEvent;
        if (failure.error === "canceled" || failure.error === "interrupted") finish();
        else finish(new Error("System narration could not be completed."));
      },
      { once: true },
    );
    stopActiveNarration = stop;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("System narration could not start."));
    }
  });
}
