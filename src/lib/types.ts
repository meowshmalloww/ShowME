export type ProviderId = "openai" | "nvidia" | "groq" | "cerebras" | "openrouter";

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

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRegion {
  id: string;
  kind: "rectangle" | "lasso" | "point" | "circle" | "arrow" | "label" | "line";
  points: Point[];
  label?: string;
}

export interface CapturePayload {
  captureId: string;
  imageDataUrl: string;
  monitor: {
    id: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleFactor: number;
  };
  capturedAt: string;
}

export interface PreparedContext {
  captureId: string;
  previewDataUrl: string;
  regions: SelectionRegion[];
  pixelWidth: number;
  pixelHeight: number;
  containsAnnotations: boolean;
}

export interface ProviderCapabilities {
  vision: boolean;
  structuredOutput: boolean;
  webSearch: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  tools: boolean;
}

export interface ProviderSummary {
  id: ProviderId;
  name: string;
  configured: boolean;
  model: string;
  baseUrl: string;
  capabilities: ProviderCapabilities;
  capabilityNote: string;
}

export interface AppSettings {
  onboardingComplete: boolean;
  petName: string;
  petScale: number;
  provider: ProviderId;
  models: Record<ProviderId, string>;
  teachingStyle: TeachingStyle;
  voiceEnabled: boolean;
  voice: string;
  language: string;
  speechRate: number;
  reducedMotion: boolean;
  memoryEnabled: boolean;
  webResearchDefault: boolean;
  imageAidsDefault: boolean;
  nearbyContextDefault: boolean;
  activeWindowDefault: boolean;
  hotkey: string;
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
  | "label"
  | "equation"
  | "path"
  | "highlight"
  | "point"
  | "vector";

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
  provider: {
    id: ProviderId;
    model: string;
  };
}

export interface GenerateLessonRequest {
  captureId: string;
  question: string;
  copiedText?: string;
  sourceUrl?: string;
  includeNearbyContext: boolean;
  includeActiveWindow: boolean;
  allowWebResearch: boolean;
  allowImageAids: boolean;
  language: string;
  teachingStyle: TeachingStyle;
  complexity: "simpler" | "standard" | "advanced";
  provider: ProviderId;
  model: string;
}

export interface LessonPresentation {
  plan: LessonPlan;
  request: GenerateLessonRequest;
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
  title: string;
  concept: string;
  question: string;
  provider: ProviderId;
  model: string;
  confidence: Confidence;
  citationCount: number;
  sourceDescription: string;
  helpful?: boolean;
}

export interface StoredLesson extends LessonReceipt {
  plan: LessonPlan;
}

export interface AppBootstrap {
  settings: AppSettings;
  providers: ProviderSummary[];
  recentLessons: LessonReceipt[];
  platform: string;
  appVersion: string;
  captureSupported: boolean;
}

export interface PermissionStatus {
  capture: "unknown" | "granted" | "denied" | "unsupported";
  microphone: "unknown" | "granted" | "denied" | "unsupported";
  note: string;
}

export interface CommandError {
  code: string;
  message: string;
  remediation?: string;
}
