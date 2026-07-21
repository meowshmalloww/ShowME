export function lessonBoardHoldMs(stepCount: number): number {
  const safeStepCount = Math.max(1, Math.min(18, Math.round(stepCount)));
  return Math.max(24_000, Math.min(40_000, 18_000 + safeStepCount * 2_500));
}

export function lessonBoardFadeMs(reducedMotion: boolean): number {
  return reducedMotion ? 120 : 900;
}

export function silentStepDurationMs(durationMs: number): number {
  return Math.max(900, Math.min(4_000, Math.round(durationMs)));
}
