import type {
  AppSettings,
  ProviderId,
  TeachingStyle,
  VoiceInputProvider,
  VoiceOutputProvider,
} from "./types";

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5.6-sol",
  alibaba: "qwen3.7-plus",
  nvidia: "nvidia/nemotron-nano-12b-v2-vl",
  groq: "meta-llama/llama-4-scout-17b-16e-instruct",
  cerebras: "gpt-oss-120b",
  openrouter: "openai/gpt-5.6-sol",
};

export const DEFAULT_TEXT_MODELS: Record<ProviderId, string> = { ...DEFAULT_MODELS };

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  assistantName: "ShowME",
  wakeEnabled: true,
  provider: "openai",
  models: { ...DEFAULT_MODELS },
  textModels: { ...DEFAULT_TEXT_MODELS },
  teachingStyle: "experiment-first",
  researchMode: "quick",
  lessonSurface: "side",
  voiceEnabled: true,
  captionsEnabled: true,
  voiceInputProvider: "openai",
  voiceOutputProvider: "system",
  microphoneDeviceId: "default",
  speakerDeviceId: "default",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  wakeSensitivity: 0.6,
  voiceSilenceMs: 3500,
  voiceMaxSeconds: 45,
  voice: "marin",
  elevenLabsVoice: "JBFqnCBsd6RMkjVDRZzb",
  language: "en",
  speechRate: 1,
  reducedMotion: false,
  memoryEnabled: true,
  webResearchDefault: false,
  imageAidsDefault: false,
  nearbyContextDefault: false,
  activeWindowDefault: false,
  hotkey: "CommandOrControl+Shift+Space",
  voiceHotkey: "CommandOrControl+Shift+V",
  theme: "system",
  providerCapabilityOverrides: {},
};

export const TEACHING_STYLE_LABELS: Record<TeachingStyle, string> = {
  "visual-fast": "Visual and fast",
  "step-by-step": "Step by step",
  formal: "Formal and technical",
  "exam-practice": "Exam practice",
  "experiment-first": "Let me experiment",
};

export const VOICES = [
  { id: "marin", label: "Marin", note: "Natural and warm" },
  { id: "cedar", label: "Cedar", note: "Grounded and clear" },
  { id: "coral", label: "Coral", note: "Bright and conversational" },
  { id: "nova", label: "Nova", note: "Warm and lively" },
  { id: "alloy", label: "Alloy", note: "Balanced" },
  { id: "onyx", label: "Onyx", note: "Deep and measured" },
] as const;

export const ELEVENLABS_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George", note: "Warm and clear" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", note: "Measured and direct" },
] as const;

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "Chinese (Simplified)" },
  { id: "zh-TW", label: "Chinese (Traditional)" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
] as const;

export const HOTKEYS = [
  { id: "CommandOrControl+Shift+Space", label: "Ctrl/Cmd + Shift + Space" },
  { id: "CommandOrControl+Shift+S", label: "Ctrl/Cmd + Shift + S" },
  { id: "CommandOrControl+Alt+Space", label: "Ctrl/Cmd + Alt + Space" },
] as const;

export const VOICE_HOTKEYS = [
  { id: "CommandOrControl+Shift+V", label: "Ctrl/Cmd + Shift + V" },
  { id: "CommandOrControl+Alt+V", label: "Ctrl/Cmd + Alt + V" },
  { id: "CommandOrControl+Shift+M", label: "Ctrl/Cmd + Shift + M" },
] as const;

export const VOICE_INPUT_LABELS: Record<VoiceInputProvider, string> = {
  openai: "OpenAI transcription",
  groq: "Groq transcription",
  deepgram: "Deepgram Nova-3",
  elevenlabs: "ElevenLabs Scribe v2",
};

export const VOICE_OUTPUT_LABELS: Record<VoiceOutputProvider, string> = {
  system: "System voice (local)",
  openai: "OpenAI speech",
  elevenlabs: "ElevenLabs speech",
};
