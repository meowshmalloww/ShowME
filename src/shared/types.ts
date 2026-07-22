export const PROVIDER_IDS = [
  "openai",
  "google",
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
export type VoiceInputProvider = "groq" | AudioProviderId;
export type VoiceOutputProvider = "system" | AudioProviderId;
export const LEARNER_GRADE_IDS = [
  "kindergarten",
  "grade-1",
  "grade-2",
  "grade-3",
  "grade-4",
  "grade-5",
  "grade-6",
  "grade-7",
  "grade-8",
  "grade-9",
  "grade-10",
  "grade-11",
  "grade-12",
  "undergraduate",
  "graduate",
  "professional",
  "self-directed",
] as const;
export type LearnerGrade = (typeof LEARNER_GRADE_IDS)[number];
export type WindowRole = "main" | "launcher" | "selection" | "lesson" | "screen-reading";
export type LauncherMode =
  | "idle"
  | "revealed"
  | "question"
  | "capturing"
  | "thinking"
  | "teaching"
  | "waiting"
  | "checking"
  | "complete"
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

export interface ScreenContrastMap {
  columns: number;
  rows: number;
  /** Row-major relative luminance samples in the inclusive 0-1 range. */
  luminance: number[];
}

export interface PreparedContext {
  captureId: string;
  previewDataUrl: string;
  /** A coordinate-scaffolded copy used only by the vision model. */
  analysisDataUrl?: string;
  /** A tiny clean-capture luminance grid used only for adaptive overlay contrast. */
  contrastMap?: ScreenContrastMap;
  regions: SelectionRegion[];
  pixelWidth: number;
  pixelHeight: number;
  /** Exact dimensions returned by Electron for the uncropped capture. */
  capturePixelWidth: number;
  capturePixelHeight: number;
  display: DisplayDescriptor;
  cropBounds: { x: number; y: number; width: number; height: number };
  containsAnnotations: boolean;
  scope: "selection" | "display" | "window";
}

/**
 * Geometry used to project normalized lesson coordinates back onto the exact
 * desktop pixels the model saw. Saved lessons may retain the non-pixel bounds
 * and scale data, while private previews and contrast samples are discarded.
 */
export interface LessonContextGeometry {
  display: DisplayDescriptor;
  cropBounds: { x: number; y: number; width: number; height: number };
  pixelWidth: number;
  pixelHeight: number;
  capturePixelWidth: number;
  capturePixelHeight: number;
  scope: PreparedContext["scope"];
  contrastMap?: ScreenContrastMap;
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
  availability?: "provider" | "catalog" | "deprecating" | "unavailable";
}

export interface AppSettings {
  onboardingComplete: boolean;
  assistantName: string;
  learnerAge: number | null;
  learnerGrade: LearnerGrade | null;
  wakeEnabled: boolean;
  provider: ProviderId;
  qwenBaseUrl: string;
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
  systemVoice: string;
  deepgramVoice: string;
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

export type LearningCheck =
  | {
      kind: "multiple-choice";
      prompt: string;
      choices: string[];
      answer: string;
      explanation: string;
    }
  | {
      kind: "numeric";
      prompt: string;
      expected: number;
      tolerance: number;
      unit: string;
      explanation: string;
    }
  | {
      kind: "keywords";
      prompt: string;
      keywords: string[];
      minimumMatches: number;
      explanation: string;
    }
  | {
      kind: "point";
      prompt: string;
      target: { x: number; y: number; width: number; height: number };
      /** A complete keyboard/voice alternative to the pointing gesture. */
      voiceAnswers: string[];
      explanation: string;
    };

export interface DiagnosticProbe {
  prompt: string;
  choices: { label: string; focusStepId: string }[];
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

export type MotionSceneLayout = "timeline" | "cause-effect" | "sequence" | "compare" | "quote";
export type MotionSceneAccent = "cyan" | "amber" | "violet" | "mint" | "coral";

export interface MotionSceneBeat {
  id: string;
  marker: string;
  heading: string;
  caption: string;
  accent: MotionSceneAccent;
}

/** A constrained, code-rendered motion-graphics explainer. It contains only
 * text and semantic layout data; no model-generated code or markup executes. */
export interface MotionSceneSimulationSpec {
  kind: "motion-scene";
  durationSeconds: number;
  title: string;
  layout: MotionSceneLayout;
  beats: MotionSceneBeat[];
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
  | MotionSceneSimulationSpec
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
  /** Optional learner self-report used to choose where the explanation begins. */
  diagnosticProbe?: DiagnosticProbe;
  /** Optional guided attempt on the representation that was just taught. */
  learningCheck?: LearningCheck;
  /** Optional independent near-transfer attempt with a changed surface form. */
  transferCheck?: LearningCheck;
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
  /** In-memory desktop projection data. AppStore removes this before persistence. */
  contextGeometry?: LessonContextGeometry;
}

export interface SpokenLessonCommandEvent {
  phrase: string;
  confidence: number;
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
  learningEvidence?: {
    result: "correct" | "retry";
    stage: LearningCheckStage;
    attemptCount: number;
    checkedAt: string;
    verifier: "local-plan-key";
  };
}

export interface LearningCheckSubmission {
  lessonId: string;
  stage: LearningCheckStage;
  response?: string;
  point?: Point;
}

export type LearningCheckStage = "try" | "transfer";

export interface LearningCheckEvaluation {
  result: "correct" | "retry";
  feedback: string;
  matched: string[];
}

export interface LearningOutcome extends LearningCheckEvaluation {
  id: string;
  lessonId: string;
  prompt: string;
  response: string;
  checkKind: LearningCheck["kind"];
  stage: LearningCheckStage;
  attemptNumber: number;
  checkedAt: string;
  verifier: "local-plan-key";
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
