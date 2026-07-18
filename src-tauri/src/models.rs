use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Openai,
    Alibaba,
    Nvidia,
    Groq,
    Cerebras,
    Openrouter,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LauncherMode {
    Peek,
    Ready,
    Menu,
    Panel,
}

impl ProviderId {
    pub const ALL: [Self; 6] = [
        Self::Openai,
        Self::Alibaba,
        Self::Nvidia,
        Self::Groq,
        Self::Cerebras,
        Self::Openrouter,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Alibaba => "alibaba",
            Self::Nvidia => "nvidia",
            Self::Groq => "groq",
            Self::Cerebras => "cerebras",
            Self::Openrouter => "openrouter",
        }
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilities {
    pub vision: bool,
    pub structured_output: bool,
    pub web_search: bool,
    pub speech_to_text: bool,
    pub text_to_speech: bool,
    pub tools: bool,
}

impl ProviderCapabilities {
    pub fn apply_override(&mut self, override_value: &ProviderCapabilityOverride) {
        if let Some(value) = override_value.vision {
            self.vision = value;
        }
        if let Some(value) = override_value.structured_output {
            self.structured_output = value;
        }
        if let Some(value) = override_value.web_search {
            self.web_search = value;
        }
        if let Some(value) = override_value.speech_to_text {
            self.speech_to_text = value;
        }
        if let Some(value) = override_value.text_to_speech {
            self.text_to_speech = value;
        }
        if let Some(value) = override_value.tools {
            self.tools = value;
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilityOverride {
    pub vision: Option<bool>,
    pub structured_output: Option<bool>,
    pub web_search: Option<bool>,
    pub speech_to_text: Option<bool>,
    pub text_to_speech: Option<bool>,
    pub tools: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    pub id: ProviderId,
    pub name: String,
    pub configured: bool,
    pub model: String,
    pub base_url: String,
    pub capabilities: ProviderCapabilities,
    pub capability_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModel {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub onboarding_complete: bool,
    pub pet_name: String,
    #[serde(default = "default_pet_scale")]
    pub pet_scale: f64,
    pub provider: ProviderId,
    pub models: HashMap<ProviderId, String>,
    pub teaching_style: TeachingStyle,
    pub voice_enabled: bool,
    pub voice: String,
    pub language: String,
    pub speech_rate: f64,
    pub reduced_motion: bool,
    pub memory_enabled: bool,
    pub web_research_default: bool,
    pub image_aids_default: bool,
    pub nearby_context_default: bool,
    pub active_window_default: bool,
    pub hotkey: String,
    pub provider_capability_overrides: HashMap<ProviderId, ProviderCapabilityOverride>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            onboarding_complete: false,
            pet_name: "ShowME".into(),
            pet_scale: default_pet_scale(),
            provider: ProviderId::Openai,
            models: HashMap::from([
                (ProviderId::Openai, "gpt-5.6-sol".into()),
                (ProviderId::Alibaba, "qwen3.7-plus".into()),
                (
                    ProviderId::Nvidia,
                    "meta/llama-4-maverick-17b-128e-instruct".into(),
                ),
                (
                    ProviderId::Groq,
                    "meta-llama/llama-4-scout-17b-16e-instruct".into(),
                ),
                (ProviderId::Cerebras, "gpt-oss-120b".into()),
                (ProviderId::Openrouter, "openai/gpt-5.6-sol".into()),
            ]),
            teaching_style: TeachingStyle::ExperimentFirst,
            voice_enabled: true,
            voice: "nova".into(),
            language: "en".into(),
            speech_rate: 1.0,
            reduced_motion: false,
            memory_enabled: true,
            web_research_default: false,
            image_aids_default: false,
            nearby_context_default: false,
            active_window_default: false,
            hotkey: "CommandOrControl+Shift+Space".into(),
            provider_capability_overrides: HashMap::new(),
        }
    }
}

fn default_pet_scale() -> f64 {
    1.0
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TeachingStyle {
    VisualFast,
    StepByStep,
    Formal,
    ExamPractice,
    ExperimentFirst,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum TeachingMode {
    VisualIntuition,
    WorkedDerivation,
    InteractiveExperiment,
    DiagramAnnotation,
    CodeExecution,
    CompareContrast,
    Simplified,
    Advanced,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum Confidence {
    VerifiedModule,
    SourceGrounded,
    Exploratory,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRegion {
    pub id: String,
    pub kind: SelectionKind,
    pub points: Vec<Point>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SelectionKind {
    Rectangle,
    Lasso,
    Point,
    Circle,
    Arrow,
    Label,
    Line,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePayload {
    pub capture_id: String,
    pub image_data_url: String,
    pub monitor: MonitorInfo,
    pub captured_at: String,
}

#[derive(Debug, Clone)]
pub struct PendingCapture {
    pub capture_id: String,
    pub png: Vec<u8>,
    pub active_window_png: Option<Vec<u8>>,
    pub active_window_title: Option<String>,
    pub monitor: MonitorInfo,
    pub captured_at: String,
}

#[derive(Debug, Clone)]
pub struct PreparedCapture {
    pub capture_id: String,
    pub png: Vec<u8>,
    pub nearby_context_png: Vec<u8>,
    pub active_window_png: Option<Vec<u8>>,
    pub active_window_title: Option<String>,
    pub regions: Vec<SelectionRegion>,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub contains_annotations: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedContext {
    pub capture_id: String,
    pub preview_data_url: String,
    pub regions: Vec<SelectionRegion>,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub contains_annotations: bool,
}

impl PreparedCapture {
    pub fn payload(&self) -> PreparedContext {
        use base64::{Engine, engine::general_purpose::STANDARD};
        PreparedContext {
            capture_id: self.capture_id.clone(),
            preview_data_url: format!("data:image/png;base64,{}", STANDARD.encode(&self.png)),
            regions: self.regions.clone(),
            pixel_width: self.pixel_width,
            pixel_height: self.pixel_height,
            contains_annotations: self.contains_annotations,
        }
    }
}

#[derive(Debug)]
pub struct AppState {
    pub database_path: PathBuf,
    pub pending_capture: Mutex<Option<PendingCapture>>,
    pub prepared_capture: Mutex<Option<PreparedCapture>>,
    pub http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLessonRequest {
    pub capture_id: String,
    pub question: String,
    pub copied_text: Option<String>,
    pub source_url: Option<String>,
    pub include_nearby_context: bool,
    pub include_active_window: bool,
    pub allow_web_research: bool,
    pub allow_image_aids: bool,
    pub language: String,
    pub teaching_style: TeachingStyle,
    pub complexity: Complexity,
    pub provider: ProviderId,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonPresentation {
    pub plan: LessonPlan,
    pub request: GenerateLessonRequest,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Complexity {
    Simpler,
    Standard,
    Advanced,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct LessonPlan {
    pub version: u8,
    pub id: String,
    pub title: String,
    pub concept: String,
    pub summary: String,
    pub teaching_mode: TeachingMode,
    pub confidence: Confidence,
    pub uncertainty: Option<String>,
    pub source_description: String,
    pub narration: String,
    pub primitives: Vec<LessonPrimitive>,
    pub steps: Vec<LessonStep>,
    pub controls: Vec<ControlSpec>,
    pub simulation: Option<SimulationSpec>,
    pub claims: Vec<Claim>,
    pub citations: Vec<Citation>,
    pub follow_ups: Vec<String>,
    pub provider: LessonProvider,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct LessonProvider {
    pub id: ProviderId,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct LessonPrimitive {
    pub id: String,
    pub kind: PrimitiveKind,
    pub x: f64,
    pub y: f64,
    pub x2: Option<f64>,
    pub y2: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub radius: Option<f64>,
    pub text: Option<String>,
    pub color: Option<String>,
    pub fill: Option<String>,
    pub stroke_width: Option<f64>,
    pub dashed: Option<bool>,
    pub points: Option<Vec<Point>>,
    pub step_id: Option<String>,
    pub source_region_id: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum PrimitiveKind {
    Circle,
    Rect,
    Line,
    Arrow,
    Label,
    Equation,
    Path,
    Highlight,
    Point,
    Vector,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct LessonStep {
    pub id: String,
    pub title: String,
    pub narration: String,
    pub primitive_ids: Vec<String>,
    pub duration_ms: u32,
    pub checkpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ControlSpec {
    pub id: String,
    pub label: String,
    pub bind: String,
    pub min: f64,
    pub max: f64,
    pub step: f64,
    pub value: f64,
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SimulationSpec {
    Orbit {
        #[serde(rename = "gravitationalParameter")]
        gravitational_parameter: f64,
        #[serde(rename = "planetRadius")]
        planet_radius: f64,
        #[serde(rename = "initialAltitude")]
        initial_altitude: f64,
        #[serde(rename = "initialVelocity")]
        initial_velocity: f64,
        #[serde(rename = "timeScale")]
        time_scale: f64,
        #[serde(rename = "showTrail")]
        show_trail: bool,
    },
    Projectile {
        gravity: f64,
        speed: f64,
        #[serde(rename = "angleDegrees")]
        angle_degrees: f64,
        #[serde(rename = "initialHeight")]
        initial_height: f64,
        #[serde(rename = "dragCoefficient")]
        drag_coefficient: f64,
    },
    Trigonometry {
        function: TrigFunction,
        amplitude: f64,
        frequency: f64,
        phase: f64,
        #[serde(rename = "angleDegrees")]
        angle_degrees: f64,
    },
    Wave {
        amplitude: f64,
        frequency: f64,
        wavelength: f64,
        phase: f64,
    },
    Circuit {
        voltage: f64,
        resistance: f64,
        capacitance: f64,
    },
    EventLoop {
        source: String,
        trace: Vec<EventLoopTraceStep>,
    },
    FunctionGraph {
        expression: GraphExpression,
        a: f64,
        b: f64,
        c: f64,
        #[serde(rename = "xMin")]
        x_min: f64,
        #[serde(rename = "xMax")]
        x_max: f64,
    },
    Custom {
        #[serde(rename = "durationSeconds")]
        duration_seconds: f64,
        entities: Vec<CustomEntity>,
        motions: Vec<CustomMotion>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum TrigFunction {
    Sin,
    Cos,
    Tan,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum GraphExpression {
    Linear,
    Quadratic,
    Exponential,
    Inverse,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct EventLoopTraceStep {
    pub id: String,
    pub phase: EventLoopPhase,
    pub action: EventLoopAction,
    pub label: String,
    pub value: Option<String>,
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum EventLoopPhase {
    Script,
    Microtask,
    Task,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum EventLoopAction {
    Execute,
    Enqueue,
    Dequeue,
    Log,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CustomEntity {
    pub id: String,
    pub shape: CustomShape,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub color: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum CustomShape {
    Circle,
    Rect,
    Arrow,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CustomMotion {
    pub entity_id: String,
    pub kind: CustomMotionKind,
    pub amplitude: f64,
    pub frequency: f64,
    pub phase: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum CustomMotionKind {
    Orbit,
    OscillateX,
    OscillateY,
    Rotate,
    Pulse,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Claim {
    pub id: String,
    pub text: String,
    pub evidence: EvidenceKind,
    pub citation_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceKind {
    SelectedSource,
    Calculation,
    WebSource,
    ModelInference,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Citation {
    pub id: String,
    pub title: String,
    pub url: String,
    pub source: String,
    pub claim_ids: Vec<String>,
    pub accessed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonReceipt {
    pub id: String,
    pub created_at: String,
    pub title: String,
    pub concept: String,
    pub question: String,
    pub provider: ProviderId,
    pub model: String,
    pub confidence: Confidence,
    pub citation_count: usize,
    pub source_description: String,
    pub helpful: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredLesson {
    #[serde(flatten)]
    pub receipt: LessonReceipt,
    pub plan: LessonPlan,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub settings: AppSettings,
    pub providers: Vec<ProviderSummary>,
    pub recent_lessons: Vec<LessonReceipt>,
    pub platform: String,
    pub app_version: String,
    pub capture_supported: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub capture: PermissionValue,
    pub microphone: PermissionValue,
    pub note: String,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PermissionValue {
    Unknown,
    Granted,
    Denied,
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageAsset {
    pub id: String,
    pub title: String,
    pub thumbnail_url: String,
    pub original_url: String,
    pub page_url: String,
    pub artist: String,
    pub license: String,
    pub license_url: String,
    pub description: String,
}
