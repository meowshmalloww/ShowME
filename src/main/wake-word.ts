import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { WakeListenerStatus } from "../shared/types";

interface WakeWordEvent {
  type: "ready" | "level" | "wake" | "error";
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
  private assistantName = "ShowME";
  private sensitivity = 0.42;
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

  configure(enabled: boolean, assistantName: string, sensitivity = 0.42): void {
    const normalizedName = assistantName.trim() || "ShowME";
    const normalizedSensitivity = Math.max(0.25, Math.min(0.9, sensitivity));
    const configurationChanged =
      normalizedName !== this.assistantName || normalizedSensitivity !== this.sensitivity;
    this.assistantName = normalizedName;
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
    this.updateStatus({ state: "starting", message: "Starting the local wake listener…" });
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
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
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
      if (message)
        this.updateStatus({
          state: "error",
          message: "Local wake listener: " + message.slice(0, 240),
        });
    });
    child.on("error", (error) => {
      this.updateStatus({
        state: "error",
        message: "Local wake listener unavailable: " + error.message,
      });
    });
    child.on("exit", () => {
      if (this.child !== child) return;
      this.child = null;
      if (this.desired && !this.suspended && !this.disposed) {
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
        this.updateStatus({
          state: "ready",
          message: "Listening locally for " + this.assistantName + ".",
          ...(event.culture ? { culture: event.culture } : {}),
          ...(event.recognizer ? { recognizer: event.recognizer } : {}),
        });
      } else if (event.type === "error" && event.message) {
        this.updateStatus({ state: "error", message: event.message });
      }
    } catch {
      // Ignore non-protocol output from the Windows speech runtime.
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
