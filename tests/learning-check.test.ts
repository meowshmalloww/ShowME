import { describe, expect, it } from "vitest";
import { evaluateLearningCheck, formatLearningCheckPrompt } from "../src/shared/learning-check";

describe("local immediate-transfer checks", () => {
  it("grades a spoken multiple-choice label without model calls", () => {
    const check = {
      kind: "multiple-choice" as const,
      prompt: "Which queue runs first?",
      choices: ["Task queue", "Microtask queue", "Render queue"],
      answer: "Microtask queue",
      explanation: "Promise microtasks run before the next task.",
    };
    expect(evaluateLearningCheck(check, "option B").result).toBe("correct");
    expect(formatLearningCheckPrompt(check)).toContain("B, Microtask queue");
  });

  it("uses numeric tolerance and accepts spoken fractions", () => {
    const check = {
      kind: "numeric" as const,
      prompt: "What is the ratio?",
      expected: 0.5,
      tolerance: 0.01,
      unit: "",
      explanation: "One divided by two is one half.",
    };
    expect(evaluateLearningCheck(check, "my answer is 1/2").result).toBe("correct");
    expect(evaluateLearningCheck(check, "0.8").result).toBe("retry");
  });

  it("requires the configured concept threshold", () => {
    const check = {
      kind: "keywords" as const,
      prompt: "Why did the outcome change?",
      keywords: ["supply", "demand", "price"],
      minimumMatches: 2,
      explanation: "Supply and demand jointly affect price.",
    };
    expect(evaluateLearningCheck(check, "Demand changed the price.").result).toBe("correct");
    expect(evaluateLearningCheck(check, "It was different.").result).toBe("retry");
  });

  it("grades a screen point locally and keeps a spoken alternative", () => {
    const check = {
      kind: "point" as const,
      prompt: "Point to angle theta.",
      target: { x: 400, y: 200, width: 120, height: 100 },
      voiceAnswers: ["angle theta", "theta"],
      explanation: "Theta is the marked angle.",
    };
    expect(evaluateLearningCheck(check, { point: { x: 460, y: 245 } }).result).toBe("correct");
    expect(evaluateLearningCheck(check, { point: { x: 700, y: 700 } }).result).toBe("retry");
    expect(evaluateLearningCheck(check, "the answer is angle theta").result).toBe("correct");
    expect(formatLearningCheckPrompt(check)).toContain("Point to it");
  });
});
