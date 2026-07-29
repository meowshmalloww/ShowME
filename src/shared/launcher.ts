import type { LauncherMode } from "./types";

export function launcherSize(mode: LauncherMode): { width: number; height: number } {
  if (mode === "idle") return { width: 104, height: 38 };
  if (mode === "revealed") return { width: 260, height: 44 };
  if (mode === "thinking") return { width: 280, height: 48 };
  if (["capturing", "teaching", "waiting", "checking", "complete"].includes(mode)) {
    return { width: 296, height: 48 };
  }
  if (mode === "transcribing") return { width: 286, height: 48 };
  if (mode === "listening" || mode === "speaking") return { width: 300, height: 50 };
  return { width: 412, height: 168 };
}

export type LauncherActivityVisual = "input-waveform" | "progress" | "output-waveform" | "none";

export function launcherActivityVisual(mode: LauncherMode): LauncherActivityVisual {
  if (mode === "listening") return "input-waveform";
  if (["transcribing", "capturing", "thinking", "checking"].includes(mode)) return "progress";
  if (mode === "speaking") return "output-waveform";
  return "none";
}
