import type { LearningCheck, LearningCheckEvaluation, Point } from "./types";

export type LearningCheckResponse = string | { response?: string; point?: Point };

export function evaluateLearningCheck(
  check: LearningCheck,
  input: LearningCheckResponse,
): LearningCheckEvaluation {
  const response = typeof input === "string" ? input : (input.response ?? "");
  const point = typeof input === "string" ? undefined : input.point;
  const normalizedResponse = normalizeLearningAnswer(response);
  if (check.kind === "multiple-choice") {
    const expectedIndex = check.choices.indexOf(check.answer);
    const expected = normalizeLearningAnswer(check.answer);
    const spokenChoice = resolveChoiceIndex(normalizedResponse, check.choices);
    const correct =
      normalizedResponse === expected ||
      (expected.length >= 3 && containsPhrase(normalizedResponse, expected)) ||
      spokenChoice === expectedIndex;
    return evaluation(correct, check.explanation, correct ? [check.answer] : []);
  }

  if (check.kind === "numeric") {
    const observed = firstNumber(response);
    const correct =
      observed !== undefined && Math.abs(observed - check.expected) <= check.tolerance;
    return evaluation(
      correct,
      check.explanation,
      correct && observed !== undefined ? [String(observed)] : [],
    );
  }

  if (check.kind === "point") {
    const inTarget = Boolean(
      point &&
        point.x >= check.target.x &&
        point.x <= check.target.x + check.target.width &&
        point.y >= check.target.y &&
        point.y <= check.target.y + check.target.height,
    );
    const matchedVoice = check.voiceAnswers.find((answer) =>
      containsPhrase(normalizedResponse, normalizeLearningAnswer(answer)),
    );
    return evaluation(
      inTarget || Boolean(matchedVoice),
      check.explanation,
      inTarget
        ? [`point:${Math.round(point?.x ?? 0)},${Math.round(point?.y ?? 0)}`]
        : matchedVoice
          ? [matchedVoice]
          : [],
    );
  }

  const matched = check.keywords.filter((keyword) =>
    containsPhrase(normalizedResponse, normalizeLearningAnswer(keyword)),
  );
  return evaluation(matched.length >= check.minimumMatches, check.explanation, matched);
}

export function formatLearningCheckPrompt(check: LearningCheck): string {
  if (check.kind === "point") {
    return `${check.prompt} Point to it, or say ${check.voiceAnswers[0]}.`;
  }
  if (check.kind !== "multiple-choice") return check.prompt;
  return `${check.prompt} ${check.choices
    .map((choice, index) => `${String.fromCharCode(65 + index)}, ${choice}`)
    .join(". ")}.`;
}

export function normalizeLearningAnswer(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function evaluation(
  correct: boolean,
  explanation: string,
  matched: string[],
): LearningCheckEvaluation {
  return {
    result: correct ? "correct" : "retry",
    feedback: correct
      ? `Yes. That matches. ${explanation}`
      : "Not quite yet. Use the visible relationships and try once more.",
    matched,
  };
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

function firstNumber(value: string): number | undefined {
  const fraction = value.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (fraction?.[1] && fraction[2]) {
    const denominator = Number(fraction[2]);
    if (denominator !== 0) return Number(fraction[1]) / denominator;
  }
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (!match) return undefined;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : undefined;
}

export function resolveChoiceIndex(value: string, choices: string[]): number | undefined {
  const normalized = normalizeLearningAnswer(value);
  const direct = choices.findIndex((choice) => {
    const expected = normalizeLearningAnswer(choice);
    return (
      normalized === expected || (expected.length >= 3 && containsPhrase(normalized, expected))
    );
  });
  if (direct >= 0) return direct;
  const match = value.match(/^(?:option\s+|choice\s+)?([a-d])(?:\b|$)/);
  if (match?.[1]) return match[1].charCodeAt(0) - 97;
  const ordinal = value.match(/^(?:option\s+|choice\s+)?(first|second|third|fourth)(?:\b|$)/)?.[1];
  return ordinal ? ["first", "second", "third", "fourth"].indexOf(ordinal) : undefined;
}
