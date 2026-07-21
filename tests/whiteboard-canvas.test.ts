import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
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
});
