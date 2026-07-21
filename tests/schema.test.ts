import { describe, expect, it } from "vitest";
import {
  lessonGenerationJsonSchema,
  lessonJsonSchema,
  validateLessonPlan,
} from "../src/shared/schema";

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

  it("rejects focus frames that extend beyond the source canvas", () => {
    expect(() =>
      validateLessonPlan({
        ...lesson,
        primitives: [
          { id: "overflow", kind: "highlight", x: 720, y: 120, width: 500, height: 300 },
        ],
        steps: [{ ...lesson.steps[0], primitiveIds: ["overflow"] }],
      }),
    ).toThrow(/stay inside.*source canvas/i);
  });

  it("rejects multi-step text-only output as an incomplete visual lesson", () => {
    expect(() =>
      validateLessonPlan({
        ...lesson,
        confidence: "exploratory",
        controls: [],
        simulation: undefined,
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

  it("treats a trusted simulation as the spatial visual across narrated steps", () => {
    expect(
      validateLessonPlan({
        ...lesson,
        primitives: [{ id: "formula", kind: "equation", x: 100, y: 100, text: "v = rω" }],
        steps: [
          { ...lesson.steps[0], id: "simulation-step-1", primitiveIds: [] },
          { ...lesson.steps[0], id: "simulation-step-2", primitiveIds: ["formula"] },
          { ...lesson.steps[0], id: "simulation-step-3", primitiveIds: [] },
        ],
      }).simulation?.kind,
    ).toBe("orbit");
  });

  it("exports a closed JSON schema for strict provider output", () => {
    const schema = lessonJsonSchema();
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("title");
  });

  it("bounds model-facing arrays more tightly than persisted lesson data", () => {
    const standard = lessonGenerationJsonSchema("standard") as {
      properties: Record<string, { maxItems?: number }>;
    };
    const repair = lessonGenerationJsonSchema("repair") as {
      properties: Record<string, { maxItems?: number }>;
    };
    expect(standard.properties.primitives?.maxItems).toBe(14);
    expect(standard.properties.steps?.maxItems).toBe(6);
    expect(repair.properties.primitives?.maxItems).toBe(8);
    expect(repair.properties.steps?.maxItems).toBe(3);
    expect(JSON.stringify(standard)).not.toMatch(/"(?:minimum|maximum|multipleOf)":/);
    expect(JSON.stringify(standard)).not.toContain('"allOf"');
    expect(JSON.stringify(standard)).not.toContain('"oneOf"');
    expect(JSON.stringify(standard)).toContain('"anyOf"');
    const refSiblings: string[] = [];
    const visit = (value: unknown, path = "$"): void => {
      if (Array.isArray(value)) {
        value.forEach((child, index) => visit(child, `${path}[${index}]`));
        return;
      }
      if (typeof value !== "object" || value === null) return;
      const object = value as Record<string, unknown>;
      if ("$ref" in object && Object.keys(object).length > 1) refSiblings.push(path);
      Object.entries(object).forEach(([key, child]) => visit(child, `${path}.${key}`));
    };
    visit(standard);
    expect(refSiblings).toEqual([]);
  });
});
