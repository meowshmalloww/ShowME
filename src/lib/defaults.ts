import type { AppSettings, ProviderId, TeachingStyle } from "./types";

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5.6-sol",
  alibaba: "qwen3.7-plus-us",
  nvidia: "meta/llama-4-maverick-17b-128e-instruct",
  groq: "meta-llama/llama-4-scout-17b-16e-instruct",
  cerebras: "gpt-oss-120b",
  openrouter: "openai/gpt-5.6-sol",
};

export const TEACHING_STYLE_LABELS: Record<TeachingStyle, string> = {
  "visual-fast": "Visual & fast",
  "step-by-step": "Step by step",
  formal: "Formal & technical",
  "exam-practice": "Exam practice",
  "experiment-first": "Let me experiment",
};

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  petName: "ShowME",
  petScale: 1,
  provider: "openai",
  models: DEFAULT_MODELS,
  teachingStyle: "experiment-first",
  voiceEnabled: true,
  voice: "nova",
  language: "en",
  speechRate: 1,
  reducedMotion: false,
  memoryEnabled: true,
  webResearchDefault: false,
  imageAidsDefault: false,
  nearbyContextDefault: false,
  activeWindowDefault: false,
  hotkey: "CommandOrControl+Shift+Space",
  providerCapabilityOverrides: {},
};

export const VOICES = [
  { id: "nova", label: "Nova — warm" },
  { id: "alloy", label: "Alloy — balanced" },
  { id: "echo", label: "Echo — clear" },
  { id: "fable", label: "Fable — expressive" },
  { id: "onyx", label: "Onyx — grounded" },
  { id: "shimmer", label: "Shimmer — bright" },
];
