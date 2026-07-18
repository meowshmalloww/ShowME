import { z } from "zod";

const coordinate = z.number().min(0).max(1000);
const positiveFinite = z.number().finite().positive();

export const pointSchema = z.object({ x: coordinate, y: coordinate });

export const primitiveSchema = z
  .object({
    id: z.string().min(1).max(80),
    kind: z.enum([
      "circle",
      "rect",
      "line",
      "arrow",
      "label",
      "equation",
      "path",
      "highlight",
      "point",
      "vector",
    ]),
    x: coordinate,
    y: coordinate,
    x2: coordinate.optional(),
    y2: coordinate.optional(),
    width: z.number().min(0).max(1000).optional(),
    height: z.number().min(0).max(1000).optional(),
    radius: z.number().min(0).max(500).optional(),
    text: z.string().max(240).optional(),
    color: z.string().max(32).optional(),
    fill: z.string().max(32).optional(),
    strokeWidth: z.number().min(0.5).max(24).optional(),
    dashed: z.boolean().optional(),
    points: z.array(pointSchema).max(120).optional(),
    stepId: z.string().max(80).optional(),
    sourceRegionId: z.string().max(80).optional(),
  })
  .strict();

const orbitSchema = z
  .object({
    kind: z.literal("orbit"),
    gravitationalParameter: positiveFinite.max(1e20),
    planetRadius: positiveFinite.max(1e10),
    initialAltitude: positiveFinite.max(1e10),
    initialVelocity: positiveFinite.max(1e5),
    timeScale: positiveFinite.max(1e5),
    showTrail: z.boolean(),
  })
  .strict();

const projectileSchema = z
  .object({
    kind: z.literal("projectile"),
    gravity: positiveFinite.max(100),
    speed: z.number().min(0).max(1e5),
    angleDegrees: z.number().min(-90).max(90),
    initialHeight: z.number().min(0).max(1e5),
    dragCoefficient: z.number().min(0).max(10),
  })
  .strict();

const trigSchema = z
  .object({
    kind: z.literal("trigonometry"),
    function: z.enum(["sin", "cos", "tan"]),
    amplitude: z.number().min(-100).max(100),
    frequency: z.number().min(0.01).max(20),
    phase: z.number().min(-100).max(100),
    angleDegrees: z.number().min(-3600).max(3600),
  })
  .strict();

const waveSchema = z
  .object({
    kind: z.literal("wave"),
    amplitude: z.number().min(0).max(100),
    frequency: z.number().min(0).max(1e6),
    wavelength: positiveFinite.max(1e9),
    phase: z.number().min(-100).max(100),
  })
  .strict();

const circuitSchema = z
  .object({
    kind: z.literal("circuit"),
    voltage: z.number().min(-1e6).max(1e6),
    resistance: positiveFinite.max(1e12),
    capacitance: z.number().min(0).max(1e3),
  })
  .strict();

const eventLoopTraceSchema = z
  .object({
    id: z.string().min(1).max(80),
    phase: z.enum(["script", "microtask", "task"]),
    action: z.enum(["execute", "enqueue", "dequeue", "log"]),
    label: z.string().min(1).max(160),
    value: z.string().max(160).optional(),
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
    a: z.number().min(-1e4).max(1e4),
    b: z.number().min(-1e4).max(1e4),
    c: z.number().min(-1e4).max(1e4),
    xMin: z.number().min(-1e6).max(1e6),
    xMax: z.number().min(-1e6).max(1e6),
  })
  .strict()
  .refine((value) => value.xMax > value.xMin, "xMax must be larger than xMin");

const customEntitySchema = z
  .object({
    id: z.string().min(1).max(80),
    shape: z.enum(["circle", "rect", "arrow"]),
    x: coordinate,
    y: coordinate,
    width: z.number().min(1).max(1000),
    height: z.number().min(1).max(1000),
    color: z.string().min(1).max(32),
    label: z.string().max(120).optional(),
  })
  .strict();

const customMotionSchema = z
  .object({
    entityId: z.string().min(1).max(80),
    kind: z.enum(["orbit", "oscillate-x", "oscillate-y", "rotate", "pulse"]),
    amplitude: z.number().min(0).max(1000),
    frequency: z.number().min(0).max(20),
    phase: z.number().min(-100).max(100),
  })
  .strict();

const customSchema = z
  .object({
    kind: z.literal("custom"),
    durationSeconds: z.number().min(0.1).max(60),
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
          message: `Motion references unknown entity ${motion.entityId}`,
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

export const lessonPlanSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(120),
    concept: z.string().min(1).max(120),
    summary: z.string().min(1).max(600),
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
    narration: z.string().min(1).max(4000),
    primitives: z.array(primitiveSchema).max(160),
    steps: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: z.string().min(1).max(120),
            narration: z.string().min(1).max(1000),
            primitiveIds: z.array(z.string().max(80)).max(80),
            durationMs: z.number().int().min(250).max(30_000),
            checkpoint: z.string().max(240).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    controls: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
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
          ),
      )
      .max(12),
    simulation: simulationSchema.optional(),
    claims: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            text: z.string().min(1).max(500),
            evidence: z.enum(["selected-source", "calculation", "web-source", "model-inference"]),
            citationIds: z.array(z.string().max(80)).max(12),
          })
          .strict(),
      )
      .max(40),
    citations: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: z.string().min(1).max(300),
            url: z.string().url().max(2048),
            source: z.string().min(1).max(160),
            claimIds: z.array(z.string().max(80)).max(40),
            accessedAt: z.string().max(64).optional(),
          })
          .strict(),
      )
      .max(24),
    followUps: z.array(z.string().min(1).max(180)).max(6),
    provider: z
      .object({
        id: z.enum(["openai", "alibaba", "nvidia", "groq", "cerebras", "openrouter"]),
        model: z.string().min(1).max(200),
      })
      .strict(),
  })
  .strict()
  .superRefine((plan, context) => {
    const primitiveIds = new Set(plan.primitives.map((item) => item.id));
    const stepIds = new Set(plan.steps.map((item) => item.id));
    for (const step of plan.steps) {
      for (const primitiveId of step.primitiveIds) {
        if (!primitiveIds.has(primitiveId)) {
          context.addIssue({
            code: "custom",
            message: `Step ${step.id} references unknown primitive ${primitiveId}`,
          });
        }
      }
    }
    for (const primitive of plan.primitives) {
      if (primitive.stepId && !stepIds.has(primitive.stepId)) {
        context.addIssue({
          code: "custom",
          message: `Primitive ${primitive.id} references unknown step ${primitive.stepId}`,
        });
      }
    }
  });

export type ValidatedLessonPlan = z.infer<typeof lessonPlanSchema>;

export function validateLessonPlan(value: unknown): ValidatedLessonPlan {
  return lessonPlanSchema.parse(value);
}
