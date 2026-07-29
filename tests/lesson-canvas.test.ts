import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonCanvas } from "../src/renderer/src/components/LessonCanvas";
import type { LessonPlan, SimulationSpec } from "../src/shared/types";

function lesson(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    version: 1,
    id: "lesson-1",
    title: "Visual lesson",
    concept: "Visible relationship",
    summary: "A compact visual lesson.",
    teachingMode: "diagram-annotation",
    confidence: "exploratory",
    sourceDescription: "Selected screen region",
    narration: "Follow the visible relationship.",
    primitives: [],
    steps: [
      {
        id: "step-1",
        title: "Look",
        narration: "Inspect the visual.",
        primitiveIds: [],
        durationMs: 900,
      },
    ],
    controls: [],
    claims: [],
    citations: [],
    followUps: [],
    provider: { id: "nvidia", model: "nvidia/nemotron-nano-12b-v2-vl" },
    ...overrides,
  };
}

function render(plan: LessonPlan, contextPreviewDataUrl?: string, stepIndex = 0): string {
  return renderToStaticMarkup(
    createElement(LessonCanvas, {
      plan,
      stepIndex,
      reducedMotion: true,
      contextPreviewDataUrl,
    }),
  );
}

describe("visual lesson canvas", () => {
  it("renders the captured screen with arrow, curved-arrow, and callout overlays", () => {
    const plan = lesson({
      primitives: [
        { id: "arrow", kind: "arrow", x: 80, y: 100, x2: 500, y2: 300 },
        { id: "curve", kind: "curved-arrow", x: 100, y: 500, x2: 650, y2: 450 },
        {
          id: "callout",
          kind: "callout",
          x: 520,
          y: 100,
          width: 260,
          height: 90,
          text: "Notice this relationship",
        },
      ],
      steps: [
        {
          id: "step-1",
          title: "Trace it",
          narration: "Follow both arrows.",
          primitiveIds: ["arrow", "curve", "callout"],
          durationMs: 900,
        },
      ],
    });
    const html = render(plan, "data:image/png;base64,AA==");
    expect(html).toContain("lesson-context-preview");
    expect(html.match(/url\(#lesson-arrow\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Notice this");
    expect(html).toContain("relationship");
  });

  it("renders constrained custom motion with an animated arrow entity", () => {
    const simulation: SimulationSpec = {
      kind: "custom",
      durationSeconds: 4,
      entities: [
        {
          id: "moving-arrow",
          shape: "arrow",
          x: 500,
          y: 500,
          width: 220,
          height: 8,
          color: "#f5f5f5",
          label: "Direction",
        },
      ],
      motions: [
        {
          entityId: "moving-arrow",
          kind: "oscillate-x",
          amplitude: 120,
          frequency: 0.5,
          phase: 0,
        },
      ],
    };
    const html = render(lesson({ simulation }));
    expect(html).toContain("Interactive custom motion simulation");
    expect(html).toContain("Direction");
    expect(html).toContain("url(#lesson-arrow)");
  });

  it("renders a safe code-driven history or reading motion scene", () => {
    const simulation: SimulationSpec = {
      kind: "motion-scene",
      durationSeconds: 8,
      title: "Cause and consequence",
      layout: "cause-effect",
      beats: [
        {
          id: "pressure",
          marker: "Cause",
          heading: "Pressure builds",
          caption: "A visible condition creates tension.",
          accent: "amber",
        },
        {
          id: "choice",
          marker: "Decision",
          heading: "A choice is made",
          caption: "The response changes what follows.",
          accent: "violet",
        },
        {
          id: "outcome",
          marker: "Effect",
          heading: "The result appears",
          caption: "The consequence completes the chain.",
          accent: "mint",
        },
      ],
    };
    const html = render(lesson({ simulation }));
    expect(html).toContain("Motion graphic: Cause and consequence");
    expect(html).toContain("motion-scene-card");
    expect(html).toContain("Pressure builds");
    expect(html).not.toContain("simulation-error");
  });

  it("synchronizes first-class motion design to the narrated lesson step", () => {
    const baseStep = lesson().steps[0];
    if (!baseStep) throw new Error("Fixture requires a lesson step");
    const plan = lesson({
      steps: [
        { ...baseStep, id: "step-1", title: "Cause" },
        { ...baseStep, id: "step-2", title: "Effect" },
      ],
      motion: {
        kind: "motion-design",
        title: "Cause and effect",
        layout: "cause-effect",
        beats: [
          {
            id: "cause",
            stepId: "step-1",
            marker: "01",
            heading: "Pressure builds",
            caption: "The condition changes.",
            accent: "amber",
            visual: "diagram",
            transition: "draw",
            durationMs: 800,
          },
          {
            id: "effect",
            stepId: "step-2",
            marker: "02",
            heading: "The result appears",
            caption: "The consequence follows.",
            accent: "mint",
            visual: "kinetic-text",
            transition: "slide",
            durationMs: 900,
          },
        ],
      },
    });

    const first = render(plan, undefined, 0);
    const second = render(plan, undefined, 1);
    expect(first).toContain('data-active-beat="cause"');
    expect(second).toContain('data-active-beat="effect"');
    expect(second).toContain("transition-slide");
    expect(second).toContain("Live visual explanation");
    expect(second).not.toContain("simulation-error");
  });

  it.each([
    {
      kind: "orbit",
      gravitationalParameter: 3.986e14,
      planetRadius: 6_371_000,
      initialAltitude: 400_000,
      initialVelocity: 7_670,
      timeScale: 1,
      showTrail: true,
    },
    {
      kind: "projectile",
      gravity: 9.81,
      speed: 20,
      angleDegrees: 45,
      initialHeight: 0,
      dragCoefficient: 0,
    },
    {
      kind: "trigonometry",
      function: "sin",
      amplitude: 1,
      frequency: 1,
      phase: 0,
      angleDegrees: 30,
    },
    { kind: "wave", amplitude: 1, frequency: 2, wavelength: 3, phase: 0 },
    { kind: "circuit", voltage: 9, resistance: 100, capacitance: 0.001 },
    {
      kind: "event-loop",
      source: "console.log('ready')",
      trace: [
        { id: "event-1", phase: "script", action: "log", label: "console.log", value: "ready" },
      ],
    },
    { kind: "function-graph", expression: "quadratic", a: 1, b: 0, c: 0, xMin: -5, xMax: 5 },
  ] as SimulationSpec[])(
    "renders the $kind lesson module without an error surface",
    (simulation) => {
      const html = render(lesson({ simulation }));
      expect(html).toContain("simulation-graphic");
      expect(html).not.toContain("simulation-error");
    },
  );
});
