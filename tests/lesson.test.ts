// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildMemoryContext } from "../src/main/lesson";
import type { AppStore } from "../src/main/store";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";

describe("learner context", () => {
  it("includes the learner-provided baseline even when adaptive memory is disabled", () => {
    const settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      learnerAge: 14,
      learnerGrade: "grade-9" as const,
      memoryEnabled: false,
    };
    const store = { listMemories: () => [] } as unknown as AppStore;
    const context = buildMemoryContext(settings, store);
    expect(context).toContain("age 14");
    expect(context).toContain("Grade 9");
    expect(context).toContain("Never infer ability");
  });

  it("adds explicit memories without replacing the learner baseline", () => {
    const settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      learnerAge: 20,
      learnerGrade: "undergraduate" as const,
      memoryEnabled: true,
    };
    const store = {
      listMemories: () => [
        {
          id: "memory-1",
          kind: "feedback",
          topic: "pacing",
          value: "slower",
          strength: 1,
          createdAt: "2026-07-20T00:00:00.000Z",
          updatedAt: "2026-07-20T00:00:00.000Z",
        },
      ],
    } as unknown as AppStore;
    const context = buildMemoryContext(settings, store);
    expect(context).toContain("Undergraduate");
    expect(context).toContain("feedback: pacing = slower");
  });
});
