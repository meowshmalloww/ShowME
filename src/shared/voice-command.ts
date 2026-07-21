import type { AdaptationKind } from "./types";

export type VoiceLessonCommand =
  | { kind: "stop" }
  | { kind: "clear" }
  | {
      kind: "adapt";
      adaptation: Exclude<AdaptationKind, "let-me-control">;
      question?: string;
      inferredQuestion: boolean;
    };

export function normalizeVoiceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVoiceLessonCommand(rawPhrase: string): VoiceLessonCommand | null {
  const original = rawPhrase.trim().slice(0, 500);
  let phrase = normalizeVoiceText(original);
  phrase = phrase.replace(/^(?:hey |okay |ok )?show me(?: please)?\s*/, "").trim();
  if (!phrase) return null;

  if (/^(?:stop|pause|stop talking|be quiet|hold on|wait)(?: please)?$/.test(phrase)) {
    return { kind: "stop" };
  }
  if (
    /^(?:clear|clear screen|clear the screen|erase|erase board|erase the board|dismiss|dismiss this|close lesson|close this lesson)(?: please)?$/.test(
      phrase,
    )
  ) {
    return { kind: "clear" };
  }
  if (
    /^(?:simpler|make it simpler|too hard|i dont understand|i still dont understand|i dont get it|i still dont get it|explain that again|try again)$/.test(
      phrase,
    )
  ) {
    return { kind: "adapt", adaptation: "simpler", inferredQuestion: false };
  }
  if (/^(?:slow down|slower|go slower|youre going too fast|too fast)$/.test(phrase)) {
    return { kind: "adapt", adaptation: "slower", inferredQuestion: false };
  }
  if (/^(?:go deeper|more detail|explain more|why does that work)$/.test(phrase)) {
    return { kind: "adapt", adaptation: "deeper", inferredQuestion: false };
  }
  if (
    /^(?:the math|the calculation|the equation|show the math|show the calculation|show the equation)$/.test(
      phrase,
    )
  ) {
    return { kind: "adapt", adaptation: "show-math", inferredQuestion: false };
  }
  if (/^(?:another example|different example|give me another example)$/.test(phrase)) {
    return { kind: "adapt", adaptation: "another-example", inferredQuestion: false };
  }
  if (/^(?:faster|speed up|go faster)$/.test(phrase)) {
    return { kind: "adapt", adaptation: "faster", inferredQuestion: false };
  }

  const words = phrase.split(" ");
  const questionLike =
    /^(?:how|what|why|where|when|which|who|can|could|would|will|does|do|is|are|if|tell me)\b/.test(
      phrase,
    );
  if (questionLike && words.length >= 2 && words.length <= 40) {
    return {
      kind: "adapt",
      adaptation: "question",
      question: original,
      inferredQuestion: true,
    };
  }
  return null;
}

export function isLikelyNarrationEcho(heard: string, currentNarration: string): boolean {
  const normalizedHeard = normalizeVoiceText(heard).replace(
    /^(?:hey |okay |ok )?show me(?: please)?\s*/,
    "",
  );
  const normalizedNarration = normalizeVoiceText(currentNarration);
  return normalizedHeard.split(" ").length >= 3 && normalizedNarration.includes(normalizedHeard);
}
