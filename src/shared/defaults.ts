import type {
  AppSettings,
  LearnerGrade,
  ProviderId,
  TeachingStyle,
  VoiceInputProvider,
  VoiceOutputProvider,
} from "./types";

export const QWEN_CLOUD_DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export const QWEN_CLOUD_API_HOSTS: readonly { label: string; url: string }[] = [
  { label: "Pay as you go · International", url: QWEN_CLOUD_DEFAULT_BASE_URL },
  {
    label: "Token Plan · International",
    url: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
  },
  {
    label: "Coding Plan · International",
    url: "https://coding-intl.dashscope.aliyuncs.com/v1",
  },
];

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
  learnerAge: null,
  learnerGrade: null,
  wakeEnabled: true,
  provider: "openai",
  qwenBaseUrl: QWEN_CLOUD_DEFAULT_BASE_URL,
  models: { ...DEFAULT_MODELS },
  textModels: { ...DEFAULT_TEXT_MODELS },
  teachingStyle: "experiment-first",
  researchMode: "quick",
  lessonSurface: "side",
  voiceEnabled: true,
  captionsEnabled: true,
  voiceInputProvider: "deepgram",
  voiceOutputProvider: "system",
  microphoneDeviceId: "default",
  speakerDeviceId: "default",
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  wakeSensitivity: 0.6,
  voiceSilenceMs: 1200,
  voiceMaxSeconds: 45,
  systemVoice: "default",
  deepgramVoice: "aura-2-helena-en",
  voice: "marin",
  elevenLabsVoice: "dj3G1R1ilKoFKhBnWOzG",
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

export const LEARNER_GRADE_OPTIONS: readonly { id: LearnerGrade; label: string }[] = [
  { id: "kindergarten", label: "Kindergarten" },
  { id: "grade-1", label: "Grade 1" },
  { id: "grade-2", label: "Grade 2" },
  { id: "grade-3", label: "Grade 3" },
  { id: "grade-4", label: "Grade 4" },
  { id: "grade-5", label: "Grade 5" },
  { id: "grade-6", label: "Grade 6" },
  { id: "grade-7", label: "Grade 7" },
  { id: "grade-8", label: "Grade 8" },
  { id: "grade-9", label: "Grade 9" },
  { id: "grade-10", label: "Grade 10" },
  { id: "grade-11", label: "Grade 11" },
  { id: "grade-12", label: "Grade 12" },
  { id: "undergraduate", label: "Undergraduate" },
  { id: "graduate", label: "Graduate" },
  { id: "professional", label: "Professional learning" },
  { id: "self-directed", label: "Self-directed / not in school" },
] as const;

export const LEARNER_GRADE_LABELS = Object.fromEntries(
  LEARNER_GRADE_OPTIONS.map((option) => [option.id, option.label]),
) as Record<LearnerGrade, string>;

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

export const DEEPGRAM_VOICES = [
  { id: "aura-2-helena-en", label: "Helena", note: "caring, natural, and friendly" },
  { id: "aura-2-andromeda-en", label: "Andromeda", note: "casual and expressive" },
  { id: "aura-2-arcas-en", label: "Arcas", note: "natural, smooth, and clear" },
  { id: "aura-2-thalia-en", label: "Thalia", note: "clear and energetic" },
  { id: "aura-2-luna-en", label: "Luna", note: "friendly and natural" },
  { id: "aura-2-orion-en", label: "Orion", note: "calm and approachable" },
  { id: "aura-2-asteria-en", label: "Asteria", note: "confident and knowledgeable" },
] as const;

export const ELEVENLABS_VOICES = [
  { id: "dj3G1R1ilKoFKhBnWOzG", label: "Eryn", note: "Friendly and relatable" },
  { id: "HDA9tsk27wYi3uq0fPcK", label: "Stuart", note: "Professional and technical" },
  { id: "1SM7GgM6IMuvQlz2BwM3", label: "Mark", note: "Relaxed and natural" },
  { id: "PT4nqlKZfc06VW1BuClj", label: "Angela", note: "Warm and down-to-earth" },
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
  groq: "Groq transcription",
  deepgram: "Deepgram Nova-3",
  elevenlabs: "ElevenLabs Scribe v2",
};

export const VOICE_OUTPUT_LABELS: Record<VoiceOutputProvider, string> = {
  system: "System voice (local)",
  deepgram: "Deepgram Aura speech",
  elevenlabs: "ElevenLabs speech",
};
