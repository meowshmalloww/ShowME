import { describe, expect, it } from "vitest";
import { TEST_PLAN } from "./testFixtures";
import { validateLessonPlan } from "./schema";

describe("lesson plan validation", () => {
  it("accepts the bundled verified orbit contract", () => {
    expect(validateLessonPlan(TEST_PLAN).simulation?.kind).toBe("orbit");
  });

  it("rejects a step that references an unknown primitive", () => {
    const invalid = structuredClone(TEST_PLAN);
    invalid.steps[0]?.primitiveIds.push("not-in-the-scene");
    expect(() => validateLessonPlan(invalid)).toThrow(/unknown primitive/i);
  });

  it("rejects executable fields outside the declarative contract", () => {
    const invalid = {
      ...structuredClone(TEST_PLAN),
      script: "fetch('https://example.com')",
    };
    expect(() => validateLessonPlan(invalid)).toThrow();
  });

  it("rejects a custom motion that targets an unknown entity", () => {
    const invalid = structuredClone(TEST_PLAN);
    invalid.simulation = {
      kind: "custom",
      durationSeconds: 3,
      entities: [
        { id: "ball", shape: "circle", x: 200, y: 200, width: 30, height: 30, color: "#78e6bc" },
      ],
      motions: [{ entityId: "missing", kind: "orbit", amplitude: 50, frequency: 1, phase: 0 }],
    };
    expect(() => validateLessonPlan(invalid)).toThrow(/unknown entity/i);
  });
});
