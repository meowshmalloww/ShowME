import { describe, expect, it } from "vitest";
import { lessonCheckForStage, nextLearningStage } from "../src/shared/learning-flow";
import type { LessonPlan } from "../src/shared/types";

const tryCheck = {
  kind: "numeric" as const,
  prompt: "What is two plus two?",
  expected: 4,
  tolerance: 0,
  unit: "",
  explanation: "Two pairs make four.",
};
const transferCheck = {
  kind: "numeric" as const,
  prompt: "What is three plus one?",
  expected: 4,
  tolerance: 0,
  unit: "",
  explanation: "Three and one more make four.",
};

describe("deterministic learning flow", () => {
  it("keeps retries in the same stage", () => {
    expect(nextLearningStage({ transferCheck }, "try", "retry")).toBe("try");
    expect(nextLearningStage({ transferCheck }, "transfer", "retry")).toBe("transfer");
  });

  it("requires an independent Transfer after a correct guided Try", () => {
    expect(nextLearningStage({ transferCheck }, "try", "correct")).toBe("transfer");
    expect(nextLearningStage({ transferCheck }, "transfer", "correct")).toBe("complete");
  });

  it("finishes after Try only when no Transfer was authored", () => {
    expect(nextLearningStage({}, "try", "correct")).toBe("complete");
  });

  it("selects the exact locally keyed check for each stage", () => {
    const plan = { learningCheck: tryCheck, transferCheck } as LessonPlan;
    expect(lessonCheckForStage(plan, "try")?.prompt).toBe(tryCheck.prompt);
    expect(lessonCheckForStage(plan, "transfer")?.prompt).toBe(transferCheck.prompt);
  });
});
