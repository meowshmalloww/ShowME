import { DEFAULT_SETTINGS } from "./defaults";
import type { AppBootstrap, LessonPlan, PreparedContext } from "./types";

export const DEMO_CONTEXT: PreparedContext = {
  captureId: "preview-capture",
  previewDataUrl: "/demo-context.svg",
  regions: [
    {
      id: "region-orbit",
      kind: "rectangle",
      points: [
        { x: 188, y: 174 },
        { x: 806, y: 786 },
      ],
    },
  ],
  pixelWidth: 1200,
  pixelHeight: 720,
  containsAnnotations: false,
};

export const DEMO_PLAN: LessonPlan = {
  version: 1,
  id: "preview-orbit-lesson",
  title: "Orbit is a fall that keeps missing",
  concept: "Orbital motion",
  summary:
    "Gravity continuously bends the satellite’s straight-line motion. At the right sideways speed, Earth curves away at the same rate the satellite falls.",
  teachingMode: "interactive-experiment",
  confidence: "verified-module",
  sourceDescription:
    "The selected orbital diagram and ShowME’s deterministic two-body physics module.",
  narration:
    "Give the satellite no sideways speed and it falls into Earth. Increase the speed and its path curves farther around the planet. Near circular velocity, falling and Earth’s curvature balance into a stable orbit.",
  primitives: [
    {
      id: "gravity-vector",
      kind: "arrow",
      x: 735,
      y: 330,
      x2: 580,
      y2: 465,
      color: "#ff7c6b",
      strokeWidth: 6,
      stepId: "gravity",
    },
    {
      id: "gravity-label",
      kind: "label",
      x: 700,
      y: 300,
      text: "gravity bends the path",
      color: "#ffd8ce",
      stepId: "gravity",
    },
    {
      id: "velocity-vector",
      kind: "vector",
      x: 765,
      y: 470,
      x2: 765,
      y2: 290,
      color: "#8fe5bc",
      strokeWidth: 6,
      stepId: "sideways",
    },
    {
      id: "velocity-label",
      kind: "label",
      x: 785,
      y: 265,
      text: "sideways velocity",
      color: "#c8ffe2",
      stepId: "sideways",
    },
  ],
  steps: [
    {
      id: "sideways",
      title: "Start with sideways motion",
      narration: "Without gravity, the satellite would keep moving in a straight line.",
      primitiveIds: ["velocity-vector", "velocity-label"],
      durationMs: 3200,
    },
    {
      id: "gravity",
      title: "Gravity turns the velocity",
      narration: "Gravity points inward, changing the direction of velocity at every moment.",
      primitiveIds: ["gravity-vector", "gravity-label", "velocity-vector", "velocity-label"],
      durationMs: 4200,
    },
    {
      id: "balance",
      title: "Now change the launch speed",
      narration: "Use the control below. Watch impact become orbit, then escape.",
      primitiveIds: ["gravity-vector", "velocity-vector"],
      durationMs: 5000,
      checkpoint: "Can you find the smallest speed that avoids impact?",
    },
  ],
  controls: [
    {
      id: "launch-speed",
      label: "Sideways speed",
      bind: "initialVelocity",
      min: 5200,
      max: 11500,
      step: 50,
      value: 7800,
      unit: "m/s",
    },
    {
      id: "time-scale",
      label: "Time scale",
      bind: "timeScale",
      min: 100,
      max: 1200,
      step: 50,
      value: 650,
      unit: "×",
    },
  ],
  simulation: {
    kind: "orbit",
    gravitationalParameter: 398600441800000,
    planetRadius: 6371000,
    initialAltitude: 400000,
    initialVelocity: 7790,
    timeScale: 650,
    showTrail: true,
  },
  claims: [
    {
      id: "claim-1",
      text: "A circular low-Earth orbit near 400 km requires about 7.67 km/s in the ideal two-body model.",
      evidence: "calculation",
      citationIds: [],
    },
    {
      id: "claim-2",
      text: "The simulation uses velocity-Verlet integration and does not include atmospheric drag or oblateness.",
      evidence: "calculation",
      citationIds: [],
    },
  ],
  citations: [],
  followUps: [
    "Why do astronauts feel weightless?",
    "Show escape velocity next",
    "What changes in an elliptical orbit?",
  ],
  provider: { id: "openai", model: "gpt-5.6-sol" },
};

export const DEMO_BOOTSTRAP: AppBootstrap = {
  settings: { ...DEFAULT_SETTINGS, onboardingComplete: true },
  providers: [
    {
      id: "openai",
      name: "OpenAI",
      configured: false,
      model: "gpt-5.6-sol",
      baseUrl: "https://api.openai.com/v1/responses",
      capabilities: {
        vision: true,
        structuredOutput: true,
        webSearch: true,
        speechToText: true,
        textToSpeech: true,
        tools: true,
      },
      capabilityNote:
        "Best-supported path for vision, strict scene output, and approved web research.",
    },
    ...(["alibaba", "nvidia", "groq", "cerebras", "openrouter"] as const).map((id) => ({
      id,
      name: {
        alibaba: "Alibaba Cloud Qwen",
        nvidia: "NVIDIA NIM",
        groq: "Groq",
        cerebras: "Cerebras",
        openrouter: "OpenRouter",
      }[id],
      configured: false,
      model: DEFAULT_SETTINGS.models[id],
      baseUrl: "",
      capabilities: {
        vision: id !== "cerebras",
        structuredOutput: id !== "nvidia" && id !== "alibaba",
        webSearch: false,
        speechToText: false,
        textToSpeech: false,
        tools: id !== "nvidia" && id !== "alibaba",
      },
      capabilityNote: "Capabilities depend on the selected provider model.",
    })),
  ],
  recentLessons: [],
  platform: "browser-preview",
  appVersion: "0.1.3",
  captureSupported: false,
};
