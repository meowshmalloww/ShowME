import type { LauncherMode } from "./types";

export function launcherSize(mode: LauncherMode): { width: number; height: number } {
  if (mode === "idle") return { width: 56, height: 8 };
  if (mode === "revealed") return { width: 236, height: 40 };
  if (mode === "thinking") return { width: 260, height: 46 };
  if (mode === "transcribing") return { width: 264, height: 46 };
  if (mode === "listening" || mode === "speaking") return { width: 280, height: 50 };
  return { width: 400, height: 176 };
}
