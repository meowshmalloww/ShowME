import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { WakeInputState } from "../shared/ipc";
import type { WakeListenerStatus } from "../shared/types";

interface WakeWordEvent {
  type: "ready" | "level" | "wake" | "processed" | "error";
  level?: number;
  phrase?: string;
  message?: string;
  culture?: string;
  recognizer?: string;
}

interface WakeWordCallbacks {
  onLevel: (level: number) => void;
  onWake: (phrase: string) => void;
  onStatus: (status: WakeListenerStatus) => void;
}

export class WakeWordService {
  private child: ChildProcess | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private desired = false;
  private suspended = false;
  private disposed = false;
  private recognizerReady = false;
  private inputBackpressured = false;
  private inputInFlight = false;
  private audioBuffer = Buffer.alloc(0);
  private newAudioBytes = 0;
  private assistantName = "ShowME";
  private sensitivity = 0.74;
  private recognizerCulture: string | undefined;
  private recognizerName: string | undefined;
  private inputState: WakeInputState = {
    state: "stopped",
    message: "Waiting for the selected microphone.",
  };
  private status: WakeListenerStatus = {
    state: "disabled",
    message: "Wake phrase listening is off.",
  };

  constructor(
    private readonly appRoot: string,
    private readonly resourcesPath: string,
    private readonly packaged: boolean,
    private readonly callbacks: WakeWordCallbacks,
  ) {}

  configure(enabled: boolean, _assistantName: string, sensitivity = 0.74): void {
    const normalizedSensitivity = Math.max(0.74, Math.min(0.9, sensitivity));
    const configurationChanged = normalizedSensitivity !== this.sensitivity;
    this.assistantName = "ShowME";
    this.sensitivity = normalizedSensitivity;
    this.desired = enabled && process.platform === "win32";
    if (!this.desired) {
      this.stop();
      this.updateStatus({
        state: "disabled",
        message: enabled
          ? "Wake phrase standby is currently available on Windows."
          : "Wake phrase listening is off.",
      });
      return;
    }
    if (configurationChanged) this.stop();
    this.start();
  }

  currentStatus(): WakeListenerStatus {
    return { ...this.status };
  }

  pushAudio(bytes: Uint8Array): void {
    const chunk = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (chunk.byteLength === 0) return;
    this.audioBuffer = Buffer.concat([this.audioBuffer, chunk]);
    if (this.audioBuffer.byteLength > 96_000) this.audioBuffer = this.audioBuffer.subarray(-96_000);
    this.newAudioBytes += chunk.byteLength;
    this.dispatchAudioWindow();
  }

  reportInputState(state: WakeInputState): void {
    this.inputState = state;
    this.updateReadiness();
    this.dispatchAudioWindow();
  }

  suspend(): void {
    this.suspended = true;
    this.stop();
  }

  resume(): void {
    this.suspended = false;
    this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.desired = false;
    this.stop();
  }

  private start(): void {
    if (this.child || !this.desired || this.suspended || this.disposed) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const scriptPath = this.packaged
      ? join(this.resourcesPath, "workers", "showme-wake.ps1")
      : join(this.appRoot, "workers", "wake", "showme-wake.ps1");
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    this.recognizerReady = false;
    this.inputBackpressured = false;
    this.inputInFlight = false;
    this.updateStatus({ state: "starting", message: "Starting the local wake recognizer…" });
    const child = spawn(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-WakePhrase",
        this.assistantName,
        "-ConfidenceThreshold",
        this.sensitivity.toFixed(2),
        "-StreamInput",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.child = child;
    let output = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      output += chunk;
      const lines = output.split(/\r?\n/);
      output = lines.pop() ?? "";
      for (const line of lines) this.handleLine(line);
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      const message = chunk.trim();
      if (message) {
        this.updateStatus({
          state: "error",
          message: `Local wake listener: ${message.slice(0, 240)}`,
        });
      }
    });
    child.stdin?.on("error", () => {
      // The pipe closes normally when the recognizer is suspended or restarted.
    });
    child.on("error", (error) => {
      this.updateStatus({
        state: "error",
        message: `Local wake listener unavailable: ${error.message}`,
      });
    });
    child.on("exit", () => {
      if (this.child !== child) return;
      this.child = null;
      this.recognizerReady = false;
      this.inputBackpressured = false;
      this.inputInFlight = false;
      if (this.desired && !this.suspended && !this.disposed) {
        this.updateStatus({ state: "starting", message: "Restarting the local wake recognizer…" });
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          this.start();
        }, 1800);
      }
    });
  }

  private stop(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const child = this.child;
    this.child = null;
    this.recognizerReady = false;
    this.inputBackpressured = false;
    this.inputInFlight = false;
    this.audioBuffer = Buffer.alloc(0);
    this.newAudioBytes = 0;
    child?.stdin?.end();
    child?.kill();
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return;
    try {
      const event = JSON.parse(trimmed) as WakeWordEvent;
      if (event.type === "level" && typeof event.level === "number") {
        this.callbacks.onLevel(normalizeWakeLevel(event.level));
      } else if (event.type === "wake") {
        this.suspended = true;
        this.callbacks.onWake(event.phrase ?? this.assistantName);
        this.stop();
      } else if (event.type === "ready") {
        this.recognizerReady = true;
        this.recognizerCulture = event.culture;
        this.recognizerName = event.recognizer;
        this.updateReadiness();
        this.dispatchAudioWindow();
      } else if (event.type === "processed") {
        this.inputInFlight = false;
        this.dispatchAudioWindow();
      } else if (event.type === "error" && event.message) {
        this.updateStatus({ state: "error", message: event.message });
      }
    } catch {
      // Ignore non-protocol output from the Windows speech runtime.
    }
  }

  private updateReadiness(): void {
    if (!this.desired || this.suspended) return;
    if (this.inputState.state === "error") {
      this.updateStatus({ state: "error", message: this.inputState.message });
      return;
    }
    if (this.recognizerReady && this.inputState.state === "ready") {
      const device = this.inputState.deviceLabel
        ? ` through ${this.inputState.deviceLabel}`
        : " through the selected microphone";
      this.updateStatus({
        state: "ready",
        message: `Listening locally for ${this.assistantName}${device}.`,
        ...(this.recognizerCulture ? { culture: this.recognizerCulture } : {}),
        ...(this.recognizerName ? { recognizer: this.recognizerName } : {}),
      });
      return;
    }
    this.updateStatus({
      state: "starting",
      message:
        this.inputState.state === "starting"
          ? this.inputState.message
          : this.recognizerReady
            ? "Recognizer ready; waiting for sound from the selected microphone."
            : "Starting the local wake recognizer…",
      ...(this.recognizerCulture ? { culture: this.recognizerCulture } : {}),
      ...(this.recognizerName ? { recognizer: this.recognizerName } : {}),
    });
  }

  private dispatchAudioWindow(): void {
    const input = this.child?.stdin;
    if (
      !input ||
      !input.writable ||
      !this.recognizerReady ||
      this.inputState.state !== "ready" ||
      this.inputBackpressured ||
      this.inputInFlight ||
      this.audioBuffer.byteLength < 32_000 ||
      this.newAudioBytes < 16_000
    ) {
      return;
    }
    const window = this.audioBuffer.subarray(-96_000);
    const payload = `${JSON.stringify({ type: "audio", pcm: window.toString("base64") })}\n`;
    this.audioBuffer = this.audioBuffer.subarray(-48_000);
    this.newAudioBytes = 0;
    this.inputInFlight = true;
    if (!input.write(payload, "utf8")) {
      this.inputBackpressured = true;
      input.once("drain", () => {
        this.inputBackpressured = false;
      });
    }
  }

  private updateStatus(status: WakeListenerStatus): void {
    this.status = status;
    this.callbacks.onStatus({ ...status });
  }
}

export function normalizeWakeLevel(level: number): number {
  const normalized = Math.max(0, Math.min(1, level / 100));
  return Math.sqrt(normalized);
}
