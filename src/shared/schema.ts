import { z } from "zod";
import { PROVIDER_IDS } from "./types";

const coordinate = z.number().finite().min(0).max(1000);
const positiveFinite = z.number().finite().positive();
const id = z.string().min(1).max(100);

export const providerIdSchema = z.enum(PROVIDER_IDS);
export const pointSchema = z.object({ x: coordinate, y: coordinate }).strict();

export const providerCapabilitiesSchema = z
  .object({
    vision: z.boolean(),
    structuredOutput: z.boolean(),
    webSearch: z.boolean(),
    speechToText: z.boolean(),
    textToSpeech: z.boolean(),
    streaming: z.boolean(),
    tools: z.boolean(),
  })
  .strict();

export const selectionRegionSchema = z
  .object({
    id,
    kind: z.enum(["rectangle", "lasso", "point", "text", "circle", "arrow", "line", "label"]),
    points: z.array(pointSchema).min(1).max(180),
    label: z.string().max(160).optional(),
  })
  .strict()
  .superRefine((region, context) => {
    const onePoint = region.kind === "point" || region.kind === "label";
    const twoPoint = ["rectangle", "text", "circle", "arrow", "line"].includes(region.kind);
    if (onePoint && region.points.length !== 1) {
      context.addIssue({
        code: "custom",
        message: region.kind + " requires exactly one point",
      });
    }
    if (twoPoint && region.points.length !== 2) {
      context.addIssue({
        code: "custom",
        message: region.kind + " requires exactly two points",
      });
    }
    if (region.kind === "lasso" && region.points.length < 3) {
      context.addIssue({ code: "custom", message: "lasso requires at least three points" });
    }
  });

const providerModelsSchema = z.object({
  openai: z.string().min(1).max(240),
  alibaba: z.string().min(1).max(240),
  nvidia: z.string().min(1).max(240),
  groq: z.string().min(1).max(240),
  cerebras: z.string().min(1).max(240),
  openrouter: z.string().min(1).max(240),
});

const capabilityOverridesSchema = z
  .object({
    openai: providerCapabilitiesSchema.partial().optional(),
    alibaba: providerCapabilitiesSchema.partial().optional(),
    nvidia: providerCapabilitiesSchema.partial().optional(),
    groq: providerCapabilitiesSchema.partial().optional(),
    cerebras: providerCapabilitiesSchema.partial().optional(),
    openrouter: providerCapabilitiesSchema.partial().optional(),
  })
  .strict();

export const appSettingsSchema = z
  .object({
    onboardingComplete: z.boolean(),
    assistantName: z.literal("ShowME"),
    wakeEnabled: z.boolean(),
    provider: providerIdSchema,
    models: providerModelsSchema.strict(),
    textModels: providerModelsSchema.strict(),
    teachingStyle: z.enum([
      "visual-fast",
      "step-by-step",
      "formal",
      "exam-practice",
      "experiment-first",
    ]),
    researchMode: z.enum(["quick", "deep"]),
    lessonSurface: z.enum(["inline", "side", "focus"]),
    voiceEnabled: z.boolean(),
    captionsEnabled: z.boolean(),
    voiceInputProvider: z.enum(["openai", "groq"]),
    voiceOutputProvider: z.enum(["system", "openai"]),
    microphoneDeviceId: z.string().min(1).max(500),
    speakerDeviceId: z.string().min(1).max(500),
    echoCancellation: z.boolean(),
    noiseSuppression: z.boolean(),
    autoGainControl: z.boolean(),
    wakeSensitivity: z.number().finite().min(0.55).max(0.9),
    voiceSilenceMs: z.number().int().min(400).max(4000),
    voiceMaxSeconds: z.number().int().min(5).max(60),
    voice: z.string().min(1).max(80),
    language: z.string().min(2).max(20),
    speechRate: z.number().finite().min(0.6).max(1.8),
    reducedMotion: z.boolean(),
    memoryEnabled: z.boolean(),
    webResearchDefault: z.boolean(),
    imageAidsDefault: z.boolean(),
    nearbyContextDefault: z.boolean(),
    activeWindowDefault: z.boolean(),
    hotkey: z.string().min(3).max(100),
    voiceHotkey: z.string().min(3).max(100),
    theme: z.enum(["system", "light", "dark"]),
    providerCapabilityOverrides: capabilityOverridesSchema,
  })
  .strict();

export const primitiveSchema = z
  .object({
    id,
    kind: z.enum([
      "circle",
      "rect",
      "line",
      "arrow",
      "curved-arrow",
      "label",
      "equation",
      "path",
      "highlight",
      "spotlight",
      "point",
      "vector",
      "bracket",
      "axis",
      "callout",
    ]),
    x: coordinate,
    y: coordinate,
    x2: coordinate.optional(),
    y2: coordinate.optional(),
    width: z.number().finite().min(0).max(1000).optional(),
    height: z.number().finite().min(0).max(1000).optional(),
    radius: z.number().finite().min(0).max(500).optional(),
    text: z.string().max(280).optional(),
    color: z.string().max(40).optional(),
    fill: z.string().max(40).optional(),
    strokeWidth: z.number().finite().min(0.5).max(24).optional(),
    dashed: z.boolean().optional(),
    points: z.array(pointSchema).max(160).optional(),
    stepId: id.optional(),
    sourceRegionId: id.optional(),
  })
  .strict();

const orbitSchema = z
  .object({
    kind: z.literal("orbit"),
    gravitationalParameter: positiveFinite.max(1e20),
    planetRadius: positiveFinite.max(1e10),
    initialAltitude: positiveFinite.max(1e10),
    initialVelocity: z.number().finite().min(0).max(1e6),
    timeScale: positiveFinite.max(1e6),
    showTrail: z.boolean(),
  })
  .strict();

const projectileSchema = z
  .object({
    kind: z.literal("projectile"),
    gravity: positiveFinite.max(100),
    speed: z.number().finite().min(0).max(1e5),
    angleDegrees: z.number().finite().min(-90).max(90),
    initialHeight: z.number().finite().min(0).max(1e5),
    dragCoefficient: z.number().finite().min(0).max(10),
  })
  .strict();

const trigSchema = z
  .object({
    kind: z.literal("trigonometry"),
    function: z.enum(["sin", "cos", "tan"]),
    amplitude: z.number().finite().min(-100).max(100),
    frequency: z.number().finite().min(0.01).max(20),
    phase: z.number().finite().min(-100).max(100),
    angleDegrees: z.number().finite().min(-3600).max(3600),
  })
  .strict();

const waveSchema = z
  .object({
    kind: z.literal("wave"),
    amplitude: z.number().finite().min(0).max(100),
    frequency: z.number().finite().min(0).max(1e6),
    wavelength: positiveFinite.max(1e9),
    phase: z.number().finite().min(-100).max(100),
  })
  .strict();

const circuitSchema = z
  .object({
    kind: z.literal("circuit"),
    voltage: z.number().finite().min(-1e6).max(1e6),
    resistance: positiveFinite.max(1e12),
    capacitance: z.number().finite().min(0).max(1e3),
  })
  .strict();

const eventLoopTraceSchema = z
  .object({
    id,
    phase: z.enum(["script", "microtask", "task"]),
    action: z.enum(["execute", "enqueue", "dequeue", "log"]),
    label: z.string().min(1).max(180),
    value: z.string().max(180).optional(),
    line: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

const eventLoopSchema = z
  .object({
    kind: z.literal("event-loop"),
    source: z.string().max(20_000),
    trace: z.array(eventLoopTraceSchema).max(160),
  })
  .strict();

const functionGraphSchema = z
  .object({
    kind: z.literal("function-graph"),
    expression: z.enum(["linear", "quadratic", "exponential", "inverse"]),
    a: z.number().finite().min(-1e4).max(1e4),
    b: z.number().finite().min(-1e4).max(1e4),
    c: z.number().finite().min(-1e4).max(1e4),
    xMin: z.number().finite().min(-1e6).max(1e6),
    xMax: z.number().finite().min(-1e6).max(1e6),
  })
  .strict()
  .refine((value) => value.xMax > value.xMin, "xMax must be larger than xMin");

const customEntitySchema = z
  .object({
    id,
    shape: z.enum(["circle", "rect", "arrow"]),
    x: coordinate,
    y: coordinate,
    width: z.number().finite().min(1).max(1000),
    height: z.number().finite().min(1).max(1000),
    color: z.string().min(1).max(40),
    label: z.string().max(120).optional(),
  })
  .strict();

const customMotionSchema = z
  .object({
    entityId: id,
    kind: z.enum(["orbit", "oscillate-x", "oscillate-y", "rotate", "pulse"]),
    amplitude: z.number().finite().min(0).max(1000),
    frequency: z.number().finite().min(0).max(20),
    phase: z.number().finite().min(-100).max(100),
  })
  .strict();

const customSchema = z
  .object({
    kind: z.literal("custom"),
    durationSeconds: z.number().finite().min(0.1).max(60),
    entities: z.array(customEntitySchema).max(40),
    motions: z.array(customMotionSchema).max(40),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set(value.entities.map((entity) => entity.id));
    for (const motion of value.motions) {
      if (!ids.has(motion.entityId)) {
        context.addIssue({
          code: "custom",
          message: "Motion references unknown entity " + motion.entityId,
        });
      }
    }
  });

export const simulationSchema = z.discriminatedUnion("kind", [
  orbitSchema,
  projectileSchema,
  trigSchema,
  waveSchema,
  circuitSchema,
  eventLoopSchema,
  functionGraphSchema,
  customSchema,
]);

const controlSchema = z
  .object({
    id,
    label: z.string().min(1).max(100),
    bind: z.string().min(1).max(100),
    min: z.number().finite(),
    max: z.number().finite(),
    step: positiveFinite,
    value: z.number().finite(),
    unit: z.string().max(24).optional(),
  })
  .strict()
  .refine((value) => value.max > value.min, "Control maximum must exceed minimum")
  .refine(
    (value) => value.value >= value.min && value.value <= value.max,
    "Control value must be in range",
  );

const allowedBindings: Record<string, ReadonlySet<string>> = {
  orbit: new Set([
    "gravitationalParameter",
    "planetRadius",
    "initialAltitude",
    "initialVelocity",
    "timeScale",
  ]),
  projectile: new Set(["gravity", "speed", "angleDegrees", "initialHeight", "dragCoefficient"]),
  trigonometry: new Set(["amplitude", "frequency", "phase", "angleDegrees"]),
  wave: new Set(["amplitude", "frequency", "wavelength", "phase"]),
  circuit: new Set(["voltage", "resistance", "capacitance"]),
  "function-graph": new Set(["a", "b", "c", "xMin", "xMax"]),
  "event-loop": new Set(),
  custom: new Set(),
};

export const lessonPlanSchema = z
  .object({
    version: z.literal(1),
    id,
    title: z.string().min(1).max(120),
    concept: z.string().min(1).max(120),
    summary: z.string().min(1).max(700),
    teachingMode: z.enum([
      "visual-intuition",
      "worked-derivation",
      "interactive-experiment",
      "diagram-annotation",
      "code-execution",
      "compare-contrast",
      "simplified",
      "advanced",
    ]),
    confidence: z.enum(["verified-module", "source-grounded", "exploratory"]),
    uncertainty: z.string().max(500).optional(),
    sourceDescription: z.string().min(1).max(500),
    narration: z.string().min(1).max(5000),
    primitives: z.array(primitiveSchema).max(180),
    steps: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(120),
            narration: z.string().min(1).max(1200),
            primitiveIds: z.array(id).max(100),
            durationMs: z.number().int().min(250).max(30_000),
            checkpoint: z.string().max(260).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(18),
    controls: z.array(controlSchema).max(12),
    simulation: simulationSchema.optional(),
    claims: z
      .array(
        z
          .object({
            id,
            text: z.string().min(1).max(600),
            evidence: z.enum(["selected-source", "calculation", "web-source", "model-inference"]),
            citationIds: z.array(id).max(12),
          })
          .strict(),
      )
      .max(48),
    citations: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(300),
            url: z.string().url().max(2048),
            source: z.string().min(1).max(160),
            claimIds: z.array(id).max(48),
            accessedAt: z.string().max(64).optional(),
          })
          .strict(),
      )
      .max(24),
    followUps: z.array(z.string().min(1).max(200)).max(8),
    provider: z
      .object({
        id: providerIdSchema,
        model: z.string().min(1).max(240),
      })
      .strict(),
  })
  .strict()
  .superRefine((plan, context) => {
    const primitiveIds = new Set(plan.primitives.map((item) => item.id));
    const stepIds = new Set(plan.steps.map((item) => item.id));
    const citationIds = new Set(plan.citations.map((item) => item.id));
    const allIds = [
      ...plan.primitives.map((item) => item.id),
      ...plan.steps.map((item) => item.id),
      ...plan.controls.map((item) => item.id),
      ...plan.claims.map((item) => item.id),
      ...plan.citations.map((item) => item.id),
    ];
    if (new Set(allIds).size !== allIds.length) {
      context.addIssue({ code: "custom", message: "Lesson IDs must be globally unique" });
    }
    for (const step of plan.steps) {
      for (const primitiveId of step.primitiveIds) {
        if (!primitiveIds.has(primitiveId)) {
          context.addIssue({
            code: "custom",
            message: "Step " + step.id + " references unknown primitive " + primitiveId,
          });
        }
      }
    }
    for (const primitive of plan.primitives) {
      if (primitive.stepId && !stepIds.has(primitive.stepId)) {
        context.addIssue({
          code: "custom",
          message: "Primitive " + primitive.id + " references unknown step " + primitive.stepId,
        });
      }
    }
    for (const claim of plan.claims) {
      for (const citationId of claim.citationIds) {
        if (!citationIds.has(citationId)) {
          context.addIssue({
            code: "custom",
            message: "Claim " + claim.id + " references unknown citation " + citationId,
          });
        }
      }
    }
    if (plan.simulation) {
      const bindings = allowedBindings[plan.simulation.kind];
      for (const control of plan.controls) {
        if (!bindings?.has(control.bind)) {
          context.addIssue({
            code: "custom",
            message:
              "Control " +
              control.id +
              " cannot bind " +
              control.bind +
              " on " +
              plan.simulation.kind,
          });
        }
      }
    } else if (plan.controls.length > 0) {
      context.addIssue({ code: "custom", message: "Controls require a simulation" });
    }
  });

const optionalHttpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"));

export const generateLessonRequestSchema = z
  .object({
    captureId: id,
    question: z.string().trim().min(1).max(4000),
    copiedText: z.string().max(30_000).optional(),
    sourceUrl: optionalHttpUrl.optional(),
    includeNearbyContext: z.boolean(),
    includeActiveWindow: z.boolean(),
    researchMode: z.enum(["quick", "deep"]),
    allowWebResearch: z.boolean(),
    allowImageAids: z.boolean(),
    language: z.string().min(2).max(20),
    teachingStyle: z.enum([
      "visual-fast",
      "step-by-step",
      "formal",
      "exam-practice",
      "experiment-first",
    ]),
    complexity: z.enum(["simpler", "standard", "advanced"]),
    provider: providerIdSchema,
    model: z.string().min(1).max(240),
    replyWithVoice: z.boolean().optional(),
    adaptation: z
      .enum([
        "simpler",
        "deeper",
        "slower",
        "faster",
        "show-math",
        "another-example",
        "let-me-control",
        "question",
      ])
      .optional(),
    priorPlanId: id.optional(),
  })
  .strict();

export type ValidatedLessonPlan = z.infer<typeof lessonPlanSchema>;

export function stripNullOptionals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullOptionals);
  if (typeof value !== "object" || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== null) result[key] = stripNullOptionals(child);
  }
  return result;
}

export function validateLessonPlan(value: unknown): ValidatedLessonPlan {
  return lessonPlanSchema.parse(stripNullOptionals(value));
}

export function lessonJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(lessonPlanSchema, {
    target: "draft-7",
    reused: "ref",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete schema.$schema;
  strictifyJsonSchema(schema);
  return schema;
}

function strictifyJsonSchema(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) strictifyJsonSchema(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const object = value as Record<string, unknown>;
  delete object.format;
  const properties =
    typeof object.properties === "object" && object.properties !== null
      ? (object.properties as Record<string, unknown>)
      : undefined;
  if (properties) {
    const required = new Set(
      Array.isArray(object.required)
        ? object.required.filter((item): item is string => typeof item === "string")
        : [],
    );
    for (const [name, child] of Object.entries(properties)) {
      if (!required.has(name)) {
        properties[name] = { anyOf: [child, { type: "null" }] };
      }
    }
    object.required = Object.keys(properties);
    object.additionalProperties = false;
  }
  for (const child of Object.values(object)) strictifyJsonSchema(child);
}
