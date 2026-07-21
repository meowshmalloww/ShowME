import { describe, expect, it } from "vitest";
import { lessonJsonSchema, validateLessonPlan } from "../src/shared/schema";

const lesson = {
  version: 1,
  id: "lesson-1",
  title: "Why the path bends",
  concept: "Orbital motion",
  summary: "Forward motion and inward acceleration combine into a curved path.",
  teachingMode: "interactive-experiment",
  confidence: "verified-module",
  sourceDescription: "The selected orbit diagram",
  narration: "Move the velocity and observe the path.",
  primitives: [{ id: "planet", kind: "circle", x: 500, y: 500, radius: 100, color: "#79e4f2" }],
  steps: [
    {
      id: "step-1",
      title: "Start with motion",
      narration: "The object begins by moving sideways.",
      primitiveIds: ["planet"],
      durationMs: 1800,
    },
  ],
  controls: [
    {
      id: "velocity-control",
      label: "Velocity",
      bind: "initialVelocity",
      min: 1000,
      max: 12000,
      step: 100,
      value: 7670,
      unit: "m/s",
    },
  ],
  simulation: {
    kind: "orbit",
    gravitationalParameter: 3.986e14,
    planetRadius: 6_371_000,
    initialAltitude: 400_000,
    initialVelocity: 7670,
    timeScale: 1,
    showTrail: true,
  },
  claims: [
    {
      id: "claim-1",
      text: "Gravity changes velocity direction.",
      evidence: "calculation",
      citationIds: [],
    },
  ],
  citations: [],
  followUps: ["What happens at escape velocity?"],
  provider: { id: "openai", model: "gpt-5.6-sol" },
};

describe("trusted lesson schema", () => {
  it("accepts a bounded deterministic lesson plan", () => {
    expect(validateLessonPlan(lesson).title).toBe("Why the path bends");
  });

  it("rejects references that the renderer cannot resolve", () => {
    expect(() =>
      validateLessonPlan({
        ...lesson,
        steps: [{ ...lesson.steps[0], primitiveIds: ["model-invented-id"] }],
      }),
    ).toThrow(/unknown primitive/i);
  });

  it("rejects invisible paths and incomplete arrows instead of silently rendering nothing", () => {
    expect(() =>
      validateLessonPlan({
        ...lesson,
        primitives: [{ id: "missing-shape", kind: "path", x: 100, y: 100 }],
        steps: [
          {
            ...lesson.steps[0],
            primitiveIds: ["missing-shape"],
          },
        ],
      }),
    ).toThrow(/Visual grounding.*path/i);
  });

  it("rejects multi-step text-only output as an incomplete visual lesson", () => {
    expect(() =>
      validateLessonPlan({
        ...lesson,
        primitives: [
          { id: "formula-a", kind: "equation", x: 100, y: 100, text: "a = b" },
          { id: "formula-b", kind: "equation", x: 100, y: 200, text: "b = c" },
        ],
        steps: [
          { ...lesson.steps[0], id: "text-step-1", primitiveIds: ["formula-a"] },
          { ...lesson.steps[0], id: "text-step-2", primitiveIds: ["formula-b"] },
        ],
      }),
    ).toThrow(/Visual grounding/i);
  });

  it("exports a closed JSON schema for strict provider output", () => {
    const schema = lessonJsonSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("title");
  });
});
