import type { LauncherMode } from "./types";

export function launcherSize(mode: LauncherMode): { width: number; height: number } {
  if (mode === "idle") return { width: 72, height: 10 };
  if (mode === "revealed") return { width: 236, height: 40 };
  if (mode === "thinking") return { width: 252, height: 44 };
  if (["capturing", "teaching", "waiting", "checking", "complete"].includes(mode)) {
    return { width: 268, height: 44 };
  }
  if (mode === "transcribing") return { width: 258, height: 44 };
  if (mode === "listening" || mode === "speaking") return { width: 272, height: 46 };
  return { width: 388, height: 160 };
}

export type LauncherActivityVisual = "input-waveform" | "progress" | "output-waveform" | "none";

export function launcherActivityVisual(mode: LauncherMode): LauncherActivityVisual {
  if (mode === "listening") return "input-waveform";
  if (["transcribing", "capturing", "thinking", "checking"].includes(mode)) return "progress";
  if (mode === "speaking") return "output-waveform";
  return "none";
}
