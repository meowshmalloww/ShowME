import type { AdaptationKind } from "./types";

export type VoiceLessonCommand =
  | { kind: "stop" }
  | { kind: "clear" }
  | { kind: "draw" }
  | { kind: "go-back" }
  | { kind: "show-both" }
  | { kind: "keep-formula" }
  | { kind: "current-only" }
  | { kind: "answer"; response: string }
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
  if (isCollaborativeInkRequest(phrase)) return { kind: "draw" };
  if (/^(?:go back|previous step|show the previous step|back one step)(?: please)?$/.test(phrase)) {
    return { kind: "go-back" };
  }
  if (/^(?:show both|show both steps|keep both steps)(?: please)?$/.test(phrase)) {
    return { kind: "show-both" };
  }
  if (
    /^(?:keep the formula|keep formula|pin the formula|leave the equation)(?: please)?$/.test(
      phrase,
    )
  ) {
    return { kind: "keep-formula" };
  }
  if (
    /^(?:current only|show only this step|clear old marks|hide old marks)(?: please)?$/.test(phrase)
  ) {
    return { kind: "current-only" };
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

  const answer = phrase.match(
    /^(?:my answer is|i think the answer is|i believe the answer is|i choose|the answer should be)\s+(.+)$/,
  );
  if (answer?.[1]) return { kind: "answer", response: answer[1].trim() };
  if (/^(?:option|choice)\s+(?:[a-d]|first|second|third|fourth)(?:\b.*)?$/.test(phrase)) {
    return { kind: "answer", response: phrase };
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

export function isCollaborativeInkRequest(rawPhrase: string): boolean {
  const phrase = normalizeVoiceText(rawPhrase)
    .replace(/^(?:hey |okay |ok )?show me(?: please)?\s*/, "")
    .trim();
  return /^(?:(?:can|could|may) i (?:draw|write|sketch|mark|highlight|underline)|let me (?:draw|write|sketch|mark|highlight|underline)|i (?:want|would like) to (?:draw|write|sketch|mark|highlight|underline)|(?:can|could) we draw together|(?:open|show) (?:the )?(?:drawing tools|pen tools|whiteboard)|let me use (?:the )?(?:pen|marker|highlighter|eraser)|(?:can|could) i use (?:the )?(?:pen|marker|highlighter|eraser)|draw with (?:you|me))(?:\b.*)?$/.test(
    phrase,
  );
}

export function isLikelyNarrationEcho(heard: string, currentNarration: string): boolean {
  const normalizedHeard = normalizeVoiceText(heard).replace(
    /^(?:hey |okay |ok )?show me(?: please)?\s*/,
    "",
  );
  const normalizedNarration = normalizeVoiceText(currentNarration);
  return normalizedHeard.split(" ").length >= 3 && normalizedNarration.includes(normalizedHeard);
}
