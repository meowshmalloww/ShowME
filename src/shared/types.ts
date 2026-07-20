export const PROVIDER_IDS = [
  "openai",
  "alibaba",
  "nvidia",
  "groq",
  "cerebras",
  "openrouter",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export const AUDIO_PROVIDER_IDS = ["deepgram", "elevenlabs"] as const;
export type AudioProviderId = (typeof AUDIO_PROVIDER_IDS)[number];
export const CREDENTIAL_IDS = [...PROVIDER_IDS, ...AUDIO_PROVIDER_IDS] as const;
export type CredentialId = (typeof CREDENTIAL_IDS)[number];
export type ResearchMode = "quick" | "deep";
export type LessonSurface = "inline" | "side" | "focus";
export type TeachingStyle =
  | "visual-fast"
  | "step-by-step"
  | "formal"
  | "exam-practice"
  | "experiment-first";
export type TeachingMode =
  | "visual-intuition"
  | "worked-derivation"
  | "interactive-experiment"
  | "diagram-annotation"
  | "code-execution"
  | "compare-contrast"
  | "simplified"
  | "advanced";
export type Confidence = "verified-module" | "source-grounded" | "exploratory";
export type VoiceInputProvider = "openai" | "groq" | "deepgram" | "elevenlabs";
export type VoiceOutputProvider = "system" | "openai" | "elevenlabs";
export type WindowRole = "main" | "launcher" | "selection" | "lesson" | "screen-reading";
export type LauncherMode =
  | "idle"
  | "revealed"
  | "question"
  | "thinking"
  | "listening"
  | "transcribing"
  | "speaking";
export type VoiceActivityState = "idle" | "listening" | "transcribing" | "speaking";

export interface WakeListenerStatus {
  state: "disabled" | "starting" | "ready" | "error";
  message: string;
  culture?: string;
  recognizer?: string;
}

export interface CredentialProtectionStatus {
  available: boolean;
  backend: string;
  requiresReentry: boolean;
  description: string;
}

export interface Point {
  x: number;
  y: number;
}

export type SelectionKind =
  | "rectangle"
  | "lasso"
  | "point"
  | "text"
  | "circle"
  | "arrow"
  | "line"
  | "label";

export interface SelectionRegion {
  id: string;
  kind: SelectionKind;
  points: Point[];
  label?: string;
}

export interface DisplayDescriptor {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

export interface CapturePayload {
  captureId: string;
  imageDataUrl: string;
  display: DisplayDescriptor;
  capturedAt: string;
}

export interface PreparedContext {
  captureId: string;
  previewDataUrl: string;
  regions: SelectionRegion[];
  pixelWidth: number;
  pixelHeight: number;
  display: DisplayDescriptor;
  cropBounds: { x: number; y: number; width: number; height: number };
  containsAnnotations: boolean;
  scope: "selection" | "display" | "window";
}

export interface ProviderCapabilities {
  vision: boolean;
  structuredOutput: boolean;
  webSearch: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  streaming: boolean;
  tools: boolean;
}

export interface ProviderSummary {
  id: ProviderId;
  name: string;
  shortName: string;
  configured: boolean;
  model: string;
  textModel: string;
  defaultCapabilities: ProviderCapabilities;
  capabilities: ProviderCapabilities;
  capabilityNote: string;
}

export interface VoiceServiceSummary {
  id: VoiceInputProvider;
  name: string;
  configured: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
}

export interface ProviderModel {
  id: string;
  name: string;
  ownedBy?: string;
  capabilities?: Partial<ProviderCapabilities>;
  availability?: "provider" | "free" | "deprecating";
}

export interface AppSettings {
  onboardingComplete: boolean;
  assistantName: string;
  wakeEnabled: boolean;
  provider: ProviderId;
  models: Record<ProviderId, string>;
  textModels: Record<ProviderId, string>;
  teachingStyle: TeachingStyle;
  researchMode: ResearchMode;
  lessonSurface: LessonSurface;
  voiceEnabled: boolean;
  captionsEnabled: boolean;
  voiceInputProvider: VoiceInputProvider;
  voiceOutputProvider: VoiceOutputProvider;
  microphoneDeviceId: string;
  speakerDeviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  wakeSensitivity: number;
  voiceSilenceMs: number;
  voiceMaxSeconds: number;
  voice: string;
  elevenLabsVoice: string;
  language: string;
  speechRate: number;
  reducedMotion: boolean;
  memoryEnabled: boolean;
  webResearchDefault: boolean;
  imageAidsDefault: boolean;
  nearbyContextDefault: boolean;
  activeWindowDefault: boolean;
  hotkey: string;
  voiceHotkey: string;
  theme: "system" | "light" | "dark";
  providerCapabilityOverrides: Partial<Record<ProviderId, Partial<ProviderCapabilities>>>;
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  source: string;
  claimIds: string[];
  accessedAt?: string;
}

export interface Claim {
  id: string;
  text: string;
  evidence: "selected-source" | "calculation" | "web-source" | "model-inference";
  citationIds: string[];
}

export type PrimitiveKind =
  | "circle"
  | "rect"
  | "line"
  | "arrow"
  | "curved-arrow"
  | "label"
  | "equation"
  | "path"
  | "highlight"
  | "spotlight"
  | "point"
  | "vector"
  | "bracket"
  | "axis"
  | "callout";

export interface LessonPrimitive {
  id: string;
  kind: PrimitiveKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  dashed?: boolean;
  points?: Point[];
  stepId?: string;
  sourceRegionId?: string;
}

export interface LessonStep {
  id: string;
  title: string;
  narration: string;
  primitiveIds: string[];
  durationMs: number;
  checkpoint?: string;
}

export interface ControlSpec {
  id: string;
  label: string;
  bind: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
}

export interface OrbitSimulationSpec {
  kind: "orbit";
  gravitationalParameter: number;
  planetRadius: number;
  initialAltitude: number;
  initialVelocity: number;
  timeScale: number;
  showTrail: boolean;
}

export interface ProjectileSimulationSpec {
  kind: "projectile";
  gravity: number;
  speed: number;
  angleDegrees: number;
  initialHeight: number;
  dragCoefficient: number;
}

export interface TrigonometrySimulationSpec {
  kind: "trigonometry";
  function: "sin" | "cos" | "tan";
  amplitude: number;
  frequency: number;
  phase: number;
  angleDegrees: number;
}

export interface WaveSimulationSpec {
  kind: "wave";
  amplitude: number;
  frequency: number;
  wavelength: number;
  phase: number;
}

export interface CircuitSimulationSpec {
  kind: "circuit";
  voltage: number;
  resistance: number;
  capacitance: number;
}

export interface EventLoopTraceStep {
  id: string;
  phase: "script" | "microtask" | "task";
  action: "execute" | "enqueue" | "dequeue" | "log";
  label: string;
  value?: string;
  line?: number;
}

export interface EventLoopSimulationSpec {
  kind: "event-loop";
  source: string;
  trace: EventLoopTraceStep[];
}

export interface FunctionGraphSimulationSpec {
  kind: "function-graph";
  expression: "linear" | "quadratic" | "exponential" | "inverse";
  a: number;
  b: number;
  c: number;
  xMin: number;
  xMax: number;
}

export interface CustomEntity {
  id: string;
  shape: "circle" | "rect" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label?: string;
}

export interface CustomMotion {
  entityId: string;
  kind: "orbit" | "oscillate-x" | "oscillate-y" | "rotate" | "pulse";
  amplitude: number;
  frequency: number;
  phase: number;
}

export interface CustomSimulationSpec {
  kind: "custom";
  durationSeconds: number;
  entities: CustomEntity[];
  motions: CustomMotion[];
}

export type SimulationSpec =
  | OrbitSimulationSpec
  | ProjectileSimulationSpec
  | TrigonometrySimulationSpec
  | WaveSimulationSpec
  | CircuitSimulationSpec
  | EventLoopSimulationSpec
  | FunctionGraphSimulationSpec
  | CustomSimulationSpec;

export interface LessonPlan {
  version: 1;
  id: string;
  title: string;
  concept: string;
  summary: string;
  teachingMode: TeachingMode;
  confidence: Confidence;
  uncertainty?: string;
  sourceDescription: string;
  narration: string;
  primitives: LessonPrimitive[];
  steps: LessonStep[];
  controls: ControlSpec[];
  simulation?: SimulationSpec;
  claims: Claim[];
  citations: Citation[];
  followUps: string[];
  provider: { id: ProviderId; model: string };
}

export type AdaptationKind =
  | "simpler"
  | "deeper"
  | "slower"
  | "faster"
  | "show-math"
  | "another-example"
  | "let-me-control"
  | "question";

export interface GenerateLessonRequest {
  captureId: string;
  question: string;
  copiedText?: string;
  sourceUrl?: string;
  includeNearbyContext: boolean;
  includeActiveWindow: boolean;
  researchMode: ResearchMode;
  allowWebResearch: boolean;
  allowImageAids: boolean;
  language: string;
  teachingStyle: TeachingStyle;
  complexity: "simpler" | "standard" | "advanced";
  provider: ProviderId;
  model: string;
  replyWithVoice?: boolean;
  adaptation?: AdaptationKind;
  priorPlanId?: string;
}

export interface VerificationResult {
  verified: boolean;
  engine: "python" | "typescript" | "none";
  summary: string;
  details: Record<string, number | string | boolean>;
}

export interface LessonPresentation {
  plan: LessonPlan;
  request: GenerateLessonRequest;
  verification: VerificationResult;
  createdAt: string;
  surface: LessonSurface;
  /** In-memory visual context for the active lesson. AppStore removes this before persistence. */
  contextPreviewDataUrl?: string;
  contextPreviewExpiresAt?: string;
}

export interface ImageAsset {
  id: string;
  title: string;
  thumbnailUrl: string;
  originalUrl: string;
  pageUrl: string;
  artist: string;
  license: string;
  licenseUrl: string;
  description: string;
}

export interface LessonReceipt {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  concept: string;
  question: string;
  provider: ProviderId;
  model: string;
  confidence: Confidence;
  citationCount: number;
  sourceDescription: string;
  teachingMode: TeachingMode;
  helpful?: boolean;
}

export interface StoredLesson extends LessonReceipt {
  presentation: LessonPresentation;
}

export interface LearningMemory {
  id: string;
  kind: "preference" | "concept" | "feedback";
  topic: string;
  value: string;
  strength: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySummary {
  lessonCount: number;
  memoryCount: number;
  currentStreak: number;
  studiedToday: boolean;
  topConcepts: { concept: string; count: number }[];
  explicitPreferences: LearningMemory[];
}

export interface PermissionStatus {
  capture: "unknown" | "granted" | "denied" | "unsupported";
  microphone: "unknown" | "granted" | "denied" | "unsupported";
  note: string;
}

export interface AppBootstrap {
  settings: AppSettings;
  providers: ProviderSummary[];
  voiceServices: VoiceServiceSummary[];
  recentLessons: LessonReceipt[];
  memorySummary: MemorySummary;
  permissions: PermissionStatus;
  platform: string;
  appVersion: string;
  captureSupported: boolean;
  workers: { rust: boolean; python: boolean };
  wakeListener: WakeListenerStatus;
  credentialProtection: CredentialProtectionStatus;
}

export interface LessonProgress {
  requestId: string;
  stage: "preparing" | "understanding" | "researching" | "verifying" | "rendering";
  message: string;
}

export interface CommandErrorShape {
  code: string;
  message: string;
  remediation?: string;
}
