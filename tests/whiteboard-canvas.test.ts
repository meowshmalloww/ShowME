import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  findGroundedSimulationHost,
  layoutWhiteboardText,
  placeWhiteboardAidOnLeft,
  projectSourceRect,
  WhiteboardCanvas,
} from "../src/renderer/src/components/WhiteboardCanvas";
import type { LessonContextGeometry, LessonPlan } from "../src/shared/types";

const geometry: LessonContextGeometry = {
  display: {
    id: 7,
    label: "Test display",
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 2,
  },
  cropBounds: { x: 384, y: 216, width: 1920, height: 1080 },
  pixelWidth: 1920,
  pixelHeight: 1080,
  capturePixelWidth: 3840,
  capturePixelHeight: 2160,
  scope: "selection",
};

const plan: LessonPlan = {
  version: 1,
  id: "whiteboard-lesson",
  title: "Right triangle",
  concept: "Tangent",
  summary: "Trace opposite and adjacent sides.",
  teachingMode: "diagram-annotation",
  confidence: "exploratory",
  sourceDescription: "Selected triangle",
  narration: "Trace the sides.",
  primitives: [
    { id: "side", kind: "arrow", x: 100, y: 200, x2: 480, y2: 600 },
    { id: "formula", kind: "equation", x: 560, y: 240, text: "tan θ = 11.9 / 10" },
  ],
  steps: [
    {
      id: "step-one",
      title: "Trace",
      narration: "Trace the opposite side, then the adjacent side.",
      primitiveIds: ["side", "formula"],
      durationMs: 1200,
    },
  ],
  controls: [],
  claims: [],
  citations: [],
  followUps: [],
  provider: { id: "openai", model: "test" },
};

describe("desktop whiteboard projection", () => {
  it("maps physical capture pixels into display-independent overlay coordinates", () => {
    expect(projectSourceRect(geometry, { width: 1920, height: 1080 })).toEqual({
      left: 192,
      top: 108,
      width: 960,
      height: 540,
    });
  });

  it("uses Electron's real capture size instead of assuming requested DPI dimensions", () => {
    expect(
      projectSourceRect(
        {
          ...geometry,
          capturePixelWidth: 3000,
          capturePixelHeight: 1800,
          cropBounds: { x: 300, y: 180, width: 1500, height: 900 },
        },
        { width: 1500, height: 900 },
      ),
    ).toEqual({ left: 150, top: 90, width: 750, height: 450 });
  });

  it("keeps long labels on screen and separates labels that target the same pixels", () => {
    const layouts = layoutWhiteboardText(
      [
        { id: "queue-a", kind: "label", x: 920, y: 100, text: "Microtask Queue (High Priority)" },
        { id: "queue-b", kind: "label", x: 940, y: 100, text: "Callback Queue (Low Priority)" },
      ],
      { left: 0, top: 0, width: 1000, height: 600 },
      { width: 1000, height: 600 },
    );
    const first = layouts["queue-a"];
    const second = layouts["queue-b"];
    if (!first || !second) throw new Error("Expected both text layouts");
    expect(first.left).toBeGreaterThanOrEqual(12);
    expect(first.right).toBeLessThanOrEqual(988);
    expect(second.right).toBeLessThanOrEqual(988);
    expect(second.top >= first.bottom || second.bottom <= first.top).toBe(true);
  });

  it("keeps short labels compact instead of covering the source with an empty plate", () => {
    const layouts = layoutWhiteboardText(
      [{ id: "angle", kind: "label", x: 620, y: 240, text: "θ" }],
      { left: 0, top: 0, width: 1000, height: 600 },
      { width: 1000, height: 600 },
    );

    expect(layouts.angle?.width).toBe(64);
  });

  it("places a simulation opposite the densest group of teaching marks", () => {
    const viewport = { width: 1000, height: 600 };
    const source = { left: 0, top: 0, width: 1000, height: 600 };
    expect(
      placeWhiteboardAidOnLeft(
        [
          { id: "code", kind: "highlight", x: 50, y: 100, width: 380, height: 420 },
          { id: "sync", kind: "arrow", x: 180, y: 240, x2: 430, y2: 240 },
          { id: "micro", kind: "arrow", x: 180, y: 360, x2: 430, y2: 360 },
        ],
        source,
        viewport,
      ),
    ).toBe(false);
    expect(
      placeWhiteboardAidOnLeft(
        [
          { id: "timeline", kind: "highlight", x: 620, y: 100, width: 330, height: 420 },
          { id: "event", kind: "circle", x: 780, y: 240, radius: 35 },
        ],
        source,
        viewport,
      ),
    ).toBe(true);
  });

  it("grounds a simulation in the model's reserved screen region instead of covering a title", () => {
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard fixture requires one lesson step");
    const host = {
      id: "sim-container",
      kind: "rect" as const,
      x: 50,
      y: 400,
      width: 900,
      height: 500,
    };
    expect(findGroundedSimulationHost([host])).toEqual(host);
    const simulationPlan: LessonPlan = {
      ...plan,
      primitives: [host],
      steps: [{ ...firstStep, primitiveIds: [host.id] }],
      simulation: {
        kind: "projectile",
        gravity: 9.8,
        speed: 30,
        angleDegrees: 45,
        initialHeight: 0,
        dragCoefficient: 0,
      },
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: simulationPlan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: geometry,
      }),
    );

    expect(html).toContain("whiteboard-simulation sim-projectile grounded");
    expect(html).not.toContain("whiteboard-simulation sim-projectile aid-left");
    expect(html).not.toContain("whiteboard-simulation sim-projectile aid-right");
  });

  it("adds a compact text-only contrast surface over bright screen pixels", () => {
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard fixture requires one lesson step");
    const brightGeometry: LessonContextGeometry = {
      ...geometry,
      contrastMap: { columns: 4, rows: 4, luminance: Array(16).fill(0.94) },
    };
    const labelPlan: LessonPlan = {
      ...plan,
      primitives: [{ id: "angle", kind: "label", x: 620, y: 240, text: "theta" }],
      steps: [{ ...firstStep, primitiveIds: ["angle"] }],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: labelPlan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: brightGeometry,
      }),
    );

    expect(html).toContain("surface-soft");
    expect(html).not.toContain("surface-halo");
  });

  it("leaves short text unboxed over clean dark pixels", () => {
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard fixture requires one lesson step");
    const darkGeometry: LessonContextGeometry = {
      ...geometry,
      contrastMap: { columns: 4, rows: 4, luminance: Array(16).fill(0.08) },
    };
    const labelPlan: LessonPlan = {
      ...plan,
      primitives: [{ id: "angle", kind: "label", x: 620, y: 240, text: "theta" }],
      steps: [{ ...firstStep, primitiveIds: ["angle"] }],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: labelPlan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: darkGeometry,
      }),
    );

    expect(html).toContain("surface-halo");
  });

  it("backs numbered teaching labels without boxing arrows or the source", () => {
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard fixture requires one lesson step");
    const darkGeometry: LessonContextGeometry = {
      ...geometry,
      contrastMap: { columns: 4, rows: 4, luminance: Array(16).fill(0.08) },
    };
    const labelPlan: LessonPlan = {
      ...plan,
      primitives: [{ id: "microtask", kind: "label", x: 240, y: 360, text: "2. Microtask" }],
      steps: [{ ...firstStep, primitiveIds: ["microtask"] }],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: labelPlan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: darkGeometry,
      }),
    );

    expect(html).toContain("surface-soft");
    expect(html).not.toContain("surface-plate");
  });

  it("renders direct ink and text without a lesson player surface", () => {
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: geometry,
      }),
    );
    expect(html).toContain("whiteboard-overlay");
    expect(html).toContain("whiteboard-geometry");
    expect(html).toContain("tan θ = 11.9 / 10");
    expect(html).not.toContain("lesson-window");
    expect(html).not.toContain("Play story");
    expect(html).not.toContain("Evidence &amp; confidence");
  });

  it("keeps the voice-driven transfer check screen-native and renders one neutral pointer", () => {
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan,
        stepIndex: 0,
        reducedMotion: false,
        contextGeometry: geometry,
        learningCheck: {
          phase: "awaiting",
          stage: "try",
          prompt: "Which side is opposite theta?",
          choices: ["11.9", "10"],
          attemptCount: 0,
        },
      }),
    );

    expect(html).toContain("whiteboard-learning-check check-awaiting");
    expect(html).toContain("Which side is opposite theta?");
    expect(html).toContain("Say “Show me, my answer is …”");
    expect(html.match(/teaching-cursor-pointer/g)).toHaveLength(1);
    expect(html).not.toContain("teaching-cursor-ring");
    expect(html).not.toContain("--teaching-cursor-color");
  });

  it("retires old annotations while preserving one context step and pinned formulas", () => {
    const historyPlan: LessonPlan = {
      ...plan,
      primitives: [
        { id: "old", kind: "label", x: 100, y: 100, text: "Retired mark" },
        { id: "previous", kind: "label", x: 200, y: 200, text: "Previous mark" },
        { id: "current", kind: "label", x: 300, y: 300, text: "Current mark" },
        { id: "formula-pin", kind: "equation", x: 500, y: 100, text: "a = b" },
      ],
      steps: [
        { id: "one", title: "One", narration: "One", primitiveIds: ["old"], durationMs: 500 },
        {
          id: "two",
          title: "Two",
          narration: "Two",
          primitiveIds: ["previous", "formula-pin"],
          durationMs: 500,
        },
        {
          id: "three",
          title: "Three",
          narration: "Three",
          primitiveIds: ["current"],
          durationMs: 500,
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: historyPlan,
        stepIndex: 2,
        reducedMotion: true,
        contextGeometry: geometry,
        pinnedPrimitiveIds: ["formula-pin"],
      }),
    );
    expect(html).not.toContain("Retired mark");
    expect(html).toContain("Previous mark");
    expect(html).toContain("Current mark");
    expect(html).toContain("a = b");
    expect(html).toContain("previous");
  });

  it("exposes click-to-point mode only while a point check is active", () => {
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: geometry,
        learningCheck: {
          phase: "awaiting",
          stage: "transfer",
          prompt: "Point to theta.",
          pointMode: true,
          attemptCount: 0,
        },
        onPointAnswer: () => undefined,
      }),
    );
    expect(html).toContain("whiteboard-overlay board-active reduced-motion point-mode");
  });

  it("renders the complete grounded drawing vocabulary on the desktop", () => {
    const primitives: LessonPlan["primitives"] = [
      { id: "circle", kind: "circle", x: 100, y: 100, radius: 40 },
      { id: "rect", kind: "rect", x: 150, y: 120, width: 120, height: 80 },
      { id: "line", kind: "line", x: 100, y: 250, x2: 300, y2: 250 },
      { id: "arrow", kind: "arrow", x: 100, y: 300, x2: 350, y2: 340 },
      { id: "curve", kind: "curved-arrow", x: 150, y: 420, x2: 420, y2: 390 },
      {
        id: "path",
        kind: "path",
        x: 100,
        y: 500,
        points: [
          { x: 100, y: 500 },
          { x: 180, y: 530 },
          { x: 260, y: 500 },
        ],
      },
      { id: "highlight", kind: "highlight", x: 430, y: 100, width: 180, height: 90 },
      { id: "spotlight", kind: "spotlight", x: 520, y: 300, radius: 75 },
      { id: "point", kind: "point", x: 650, y: 300 },
      { id: "vector", kind: "vector", x: 600, y: 420, x2: 820, y2: 360 },
      { id: "bracket", kind: "bracket", x: 840, y: 120, height: 180 },
      { id: "axis", kind: "axis", x: 720, y: 650, x2: 920, y2: 450 },
      { id: "label", kind: "label", x: 80, y: 700, text: "1. Start here" },
      { id: "equation", kind: "equation", x: 360, y: 760, text: "tan θ = opposite / adjacent" },
      { id: "callout", kind: "callout", x: 720, y: 780, text: "This angle changes" },
    ];
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard test fixture requires one lesson step");
    const completePlan: LessonPlan = {
      ...plan,
      primitives,
      steps: [{ ...firstStep, primitiveIds: primitives.map((primitive) => primitive.id) }],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: completePlan,
        stepIndex: 0,
        reducedMotion: false,
        contextGeometry: geometry,
      }),
    );

    expect(html).toContain("whiteboard-stroke current");
    expect(html).toContain("whiteboard-spotlight current");
    expect(html).toMatch(/url\(#whiteboard-arrow-(?:cyan|amber|violet|mint|coral)\)/);
    expect(html).toContain("teaching-cursor");
    expect(html).toContain("teaching-cursor-pointer");
    expect(html).not.toContain("teaching-cursor-ring");
    expect(html).toContain("surface-soft");
    expect(html).toContain("surface-plate");
    expect(html).toContain("#ffc857");
    expect(html).toContain("#b79cff");
    expect(html).toContain("1. Start here");
    expect(html).toContain("tan θ = opposite / adjacent");
    expect(html).toContain("This angle changes");
    expect(html).toContain("<polyline");
    expect(html).toContain("<ellipse");
    expect(html).toContain("<rect");
    expect(html).toContain("rgba(255, 200, 87, 0.05)");
  });

  it("renders broad source highlights as quiet guides instead of neon panels", () => {
    const firstStep = plan.steps[0];
    if (!firstStep) throw new Error("Whiteboard test fixture requires one lesson step");
    const broadPlan: LessonPlan = {
      ...plan,
      primitives: [
        {
          id: "broad-source",
          kind: "highlight",
          x: 40,
          y: 120,
          width: 410,
          height: 470,
        },
      ],
      steps: [{ ...firstStep, primitiveIds: ["broad-source"] }],
    };
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan: broadPlan,
        stepIndex: 0,
        reducedMotion: false,
        contextGeometry: geometry,
      }),
    );

    expect(html).toContain("whiteboard-stroke broad-highlight current");
    expect(html).toContain('fill="transparent"');
    expect(html).toContain('stroke-opacity="0.58"');
    expect(html).toContain('stroke-dasharray="10 13"');
  });

  it("can place a licensed image aid beside the original-screen whiteboard", () => {
    const html = renderToStaticMarkup(
      createElement(WhiteboardCanvas, {
        plan,
        stepIndex: 0,
        reducedMotion: true,
        contextGeometry: geometry,
        imageAsset: {
          id: "asset-1",
          title: "Reference triangle",
          thumbnailUrl: "data:image/png;base64,AA==",
          originalUrl: "https://commons.wikimedia.org/example.png",
          pageUrl: "https://commons.wikimedia.org/wiki/File:Example.png",
          artist: "Example author",
          license: "CC BY 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
          description: "A labeled triangle",
        },
      }),
    );

    expect(html).toContain("whiteboard-media");
    expect(html).toContain("A labeled triangle");
    expect(html).toContain("CC BY 4.0");
  });
});
