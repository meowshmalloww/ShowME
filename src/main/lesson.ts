import { CommandError } from "../shared/errors";
import { generateLessonRequestSchema } from "../shared/schema";
import type {
  AdaptationKind,
  AppSettings,
  GenerateLessonRequest,
  LessonPresentation,
  LessonProgress,
} from "../shared/types";
import type { CaptureService } from "./capture";
import type { ProviderService } from "./providers";
import type { AppStore } from "./store";
import type { WorkerService } from "./workers";

export class LessonService {
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly capture: CaptureService,
    private readonly providers: ProviderService,
    private readonly workers: WorkerService,
    private readonly store: AppStore,
    private readonly progress: (progress: LessonProgress) => void,
  ) {}

  async generate(
    rawRequest: GenerateLessonRequest,
  ): Promise<{ requestId: string; presentation: LessonPresentation }> {
    const request = generateLessonRequestSchema.parse(rawRequest) as GenerateLessonRequest;
    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    this.active.set(requestId, controller);
    try {
      this.emit(requestId, "preparing", "Securing the selected context");
      const context = this.capture.getPrepared(request.captureId);
      const settings = this.store.getSettings();
      this.emit(requestId, "understanding", "Reading the visual structure");
      if (request.allowWebResearch) this.emit(requestId, "researching", "Checking cited sources");
      const plan = await this.providers.generate({
        request,
        context,
        settings,
        memoryContext: buildMemoryContext(settings, this.store),
        signal: controller.signal,
      });
      this.emit(requestId, "verifying", "Running deterministic checks");
      const verification = await this.workers.verify(plan.simulation);
      const safePlan =
        plan.confidence === "verified-module" && !verification.verified
          ? {
              ...plan,
              confidence: "exploratory" as const,
              uncertainty:
                plan.uncertainty ||
                "The interactive parameters could not be independently verified on this device.",
            }
          : plan;
      this.emit(requestId, "rendering", "Composing the interactive lesson");
      const presentation: LessonPresentation = {
        plan: safePlan,
        request,
        verification,
        createdAt: new Date().toISOString(),
        surface: settings.lessonSurface,
      };
      this.store.saveLesson(presentation);
      if (settings.memoryEnabled) {
        this.store.upsertMemory("concept", safePlan.concept, request.complexity, 0.25);
        this.store.upsertMemory("preference", "teaching-style", request.teachingStyle, 0.1);
      }
      return { requestId, presentation };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new CommandError("GENERATION_CANCELLED", "Lesson generation was cancelled.");
      }
      throw error;
    } finally {
      this.active.delete(requestId);
    }
  }

  async adapt(
    presentation: LessonPresentation,
    adaptation: AdaptationKind,
    question?: string,
  ): Promise<{ requestId: string; presentation: LessonPresentation }> {
    const request: GenerateLessonRequest = {
      ...presentation.request,
      question: adaptationPrompt(adaptation, presentation, question),
      copiedText: [
        presentation.request.copiedText,
        "Prior lesson title: " + presentation.plan.title,
        "Prior lesson summary: " + presentation.plan.summary,
        "Prior lesson narration: " + presentation.plan.narration,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 30_000),
      adaptation,
      priorPlanId: presentation.plan.id,
      complexity:
        adaptation === "simpler"
          ? "simpler"
          : adaptation === "deeper" || adaptation === "show-math"
            ? "advanced"
            : presentation.request.complexity,
    };
    return this.generate(request);
  }

  cancel(requestId: string): void {
    this.active.get(requestId)?.abort();
  }

  private emit(requestId: string, stage: LessonProgress["stage"], message: string): void {
    this.progress({ requestId, stage, message });
  }
}

function buildMemoryContext(settings: AppSettings, store: AppStore): string {
  if (!settings.memoryEnabled) return "";
  return store
    .listMemories()
    .slice(0, 10)
    .map((memory) => memory.kind + ": " + memory.topic + " = " + memory.value)
    .join("\n");
}

function adaptationPrompt(
  adaptation: AdaptationKind,
  presentation: LessonPresentation,
  question?: string,
): string {
  const subject = presentation.plan.concept;
  const prompts: Record<AdaptationKind, string> = {
    simpler:
      "Rebuild the lesson about " + subject + " with simpler language and one concrete analogy.",
    deeper: "Go deeper on " + subject + ". Explain the causal mechanism and edge cases.",
    slower: "Rebuild the lesson about " + subject + " with smaller steps and more checkpoints.",
    faster: "Give a concise visual explanation of " + subject + " in at most four steps.",
    "show-math":
      "Derive the key mathematics behind " + subject + " and connect each equation to the visual.",
    "another-example": "Teach " + subject + " through a different worked example.",
    "let-me-control":
      "Rebuild the lesson about " + subject + " around meaningful learner controls.",
    question: question?.trim() || "Answer a follow-up question about " + subject + ".",
  };
  return prompts[adaptation] + (question?.trim() ? "\nFollow-up: " + question.trim() : "");
}
