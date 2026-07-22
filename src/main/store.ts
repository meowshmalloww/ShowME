import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { lessonCheckForStage } from "../shared/learning-flow";
import { appSettingsSchema } from "../shared/schema";
import type {
  AppSettings,
  LearningCheckEvaluation,
  LearningCheckStage,
  LearningMemory,
  LearningOutcome,
  LessonPresentation,
  LessonReceipt,
  MemorySummary,
  StoredLesson,
} from "../shared/types";

type Row = Record<string, unknown>;

export class AppStore {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        title TEXT NOT NULL,
        concept TEXT NOT NULL,
        question TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        confidence TEXT NOT NULL,
        citation_count INTEGER NOT NULL,
        source_description TEXT NOT NULL,
        teaching_mode TEXT NOT NULL,
        helpful INTEGER,
        presentation_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS lessons_updated_idx ON lessons(updated_at DESC);
      CREATE INDEX IF NOT EXISTS lessons_concept_idx ON lessons(concept);
      CREATE TABLE IF NOT EXISTS lesson_outcomes (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        check_kind TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'try',
        attempt_number INTEGER NOT NULL,
        result TEXT NOT NULL,
        feedback TEXT NOT NULL,
        matched_json TEXT NOT NULL,
        verifier TEXT NOT NULL,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS lesson_outcomes_lesson_idx
        ON lesson_outcomes(lesson_id, checked_at DESC);
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        topic TEXT NOT NULL,
        value TEXT NOT NULL,
        strength REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS memories_identity_idx
        ON memories(kind, topic, value);
    `);
    const outcomeColumns = this.db.prepare("PRAGMA table_info(lesson_outcomes)").all() as Row[];
    if (!outcomeColumns.some((column) => String(column.name) === "stage")) {
      this.db.exec("ALTER TABLE lesson_outcomes ADD COLUMN stage TEXT NOT NULL DEFAULT 'try'");
    }
  }

  close(): void {
    this.db.close();
  }

  getSettings(): AppSettings {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE id = 1").get() as
      | Row
      | undefined;
    if (!row) return structuredClone(DEFAULT_SETTINGS);
    try {
      const saved = JSON.parse(String(row.value_json)) as Omit<
        Partial<AppSettings>,
        "voiceInputProvider" | "voiceOutputProvider"
      > & {
        accent?: unknown;
        voiceInputProvider?: unknown;
        voiceOutputProvider?: unknown;
      };
      // Remove the pre-release appearance flag while retaining the now-connected wake setting.
      // Keeping this small read migration avoids resetting otherwise valid user settings.
      delete saved.accent;
      const models = { ...DEFAULT_SETTINGS.models, ...saved.models };
      const textModels = { ...DEFAULT_SETTINGS.textModels, ...saved.textModels };
      if (models.groq === "meta-llama/llama-4-scout-17b-16e-instruct") {
        models.groq = DEFAULT_SETTINGS.models.groq;
      }
      if (textModels.groq === "meta-llama/llama-4-scout-17b-16e-instruct") {
        textModels.groq = DEFAULT_SETTINGS.textModels.groq;
      }
      if (
        models.nvidia === "meta/llama-4-maverick-17b-128e-instruct" ||
        models.nvidia === "qwen/qwen3.5-122b-a10b" ||
        models.nvidia === "thinkingmachines/inkling"
      ) {
        models.nvidia = DEFAULT_SETTINGS.models.nvidia;
      }
      if (
        textModels.nvidia === "meta/llama-4-maverick-17b-128e-instruct" ||
        textModels.nvidia === "qwen/qwen3.5-122b-a10b" ||
        textModels.nvidia === "thinkingmachines/inkling"
      ) {
        textModels.nvidia = DEFAULT_SETTINGS.textModels.nvidia;
      }
      return appSettingsSchema.parse({
        ...DEFAULT_SETTINGS,
        ...saved,
        // ShowME is a product name and a wake phrase, not a user-editable persona.
        assistantName: "ShowME",
        // The old 74% default rejected too many real voices. The recognizer now combines
        // utterance segmentation, dictation screening, and closed-grammar confidence.
        wakeSensitivity:
          saved.wakeSensitivity === 0.74
            ? DEFAULT_SETTINGS.wakeSensitivity
            : Math.max(0.55, saved.wakeSensitivity ?? DEFAULT_SETTINGS.wakeSensitivity),
        // Replace the former 3-4 second endpoint with a responsive conversational pause while
        // preserving any already-saved value that falls inside the new supported range.
        voiceSilenceMs:
          saved.voiceSilenceMs === undefined || saved.voiceSilenceMs >= 3000
            ? DEFAULT_SETTINGS.voiceSilenceMs
            : Math.max(800, Math.min(2500, saved.voiceSilenceMs)),
        // OpenAI remains available as a lesson-model provider, but ShowME no longer routes audio
        // to it. Retire the pre-release OpenAI speech selections without losing other settings.
        voiceInputProvider:
          saved.voiceInputProvider === "openai"
            ? DEFAULT_SETTINGS.voiceInputProvider
            : (saved.voiceInputProvider ?? DEFAULT_SETTINGS.voiceInputProvider),
        voiceOutputProvider:
          saved.voiceOutputProvider === "openai"
            ? DEFAULT_SETTINGS.voiceOutputProvider
            : (saved.voiceOutputProvider ?? DEFAULT_SETTINGS.voiceOutputProvider),
        deepgramVoice:
          saved.deepgramVoice === "aura-2-thalia-en" || saved.deepgramVoice === undefined
            ? DEFAULT_SETTINGS.deepgramVoice
            : saved.deepgramVoice,
        elevenLabsVoice:
          saved.elevenLabsVoice === "JBFqnCBsd6RMkjVDRZzb" || saved.elevenLabsVoice === undefined
            ? DEFAULT_SETTINGS.elevenLabsVoice
            : saved.elevenLabsVoice,
        voiceMaxSeconds:
          saved.voiceMaxSeconds === 20 || saved.voiceMaxSeconds === undefined
            ? DEFAULT_SETTINGS.voiceMaxSeconds
            : saved.voiceMaxSeconds,
        models,
        textModels,
        providerCapabilityOverrides: saved.providerCapabilityOverrides ?? {},
      }) as AppSettings;
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  saveSettings(settings: AppSettings): AppSettings {
    const validated = appSettingsSchema.parse({
      ...settings,
      assistantName: "ShowME",
    }) as AppSettings;
    this.db
      .prepare(`
        INSERT INTO settings(id, value_json, updated_at) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `)
      .run(JSON.stringify(validated), new Date().toISOString());
    return validated;
  }

  saveLesson(presentation: LessonPresentation): StoredLesson {
    const now = new Date().toISOString();
    const { plan, request } = presentation;
    const persistedPresentation = { ...presentation };
    delete persistedPresentation.contextPreviewDataUrl;
    delete persistedPresentation.contextPreviewExpiresAt;
    if (persistedPresentation.contextGeometry) {
      persistedPresentation.contextGeometry = structuredClone(
        persistedPresentation.contextGeometry,
      );
      // Crop projection is required to put a saved lesson back on the pixels it
      // was authored against. Keep only geometry; never persist sampled screen
      // luminance or the user's monitor label alongside the lesson.
      delete persistedPresentation.contextGeometry.contrastMap;
      persistedPresentation.contextGeometry.display.label = "Saved display";
    }
    const existing = this.db
      .prepare("SELECT created_at, helpful FROM lessons WHERE id = ?")
      .get(plan.id) as Row | undefined;
    const createdAt = existing ? String(existing.created_at) : presentation.createdAt || now;
    this.db
      .prepare(`
        INSERT INTO lessons(
          id, created_at, updated_at, title, concept, question, provider, model,
          confidence, citation_count, source_description, teaching_mode, helpful,
          presentation_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          updated_at = excluded.updated_at,
          title = excluded.title,
          concept = excluded.concept,
          question = excluded.question,
          provider = excluded.provider,
          model = excluded.model,
          confidence = excluded.confidence,
          citation_count = excluded.citation_count,
          source_description = excluded.source_description,
          teaching_mode = excluded.teaching_mode,
          presentation_json = excluded.presentation_json
      `)
      .run(
        plan.id,
        createdAt,
        now,
        plan.title,
        plan.concept,
        request.question,
        plan.provider.id,
        plan.provider.model,
        plan.confidence,
        plan.citations.length,
        plan.sourceDescription,
        plan.teachingMode,
        existing?.helpful === undefined || existing.helpful === null
          ? null
          : Number(existing.helpful),
        JSON.stringify(persistedPresentation),
      );
    return this.getLesson(plan.id);
  }

  listLessons(query = "", limit = 100): LessonReceipt[] {
    const normalized = query.trim();
    const rows = normalized
      ? (this.db
          .prepare(`
            SELECT lessons.*,
              (SELECT result FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_result,
              (SELECT stage FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_stage,
              (SELECT COUNT(*) FROM lesson_outcomes WHERE lesson_id = lessons.id) AS learning_attempt_count,
              (SELECT checked_at FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_checked_at
            FROM lessons
            WHERE lessons.title LIKE ? ESCAPE '\\' OR lessons.concept LIKE ? ESCAPE '\\'
              OR lessons.question LIKE ? ESCAPE '\\'
            ORDER BY updated_at DESC LIMIT ?
          `)
          .all(...Array(3).fill("%" + escapeLike(normalized) + "%"), limit) as Row[])
      : (this.db
          .prepare(`
            SELECT lessons.*,
              (SELECT result FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_result,
              (SELECT stage FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_stage,
              (SELECT COUNT(*) FROM lesson_outcomes WHERE lesson_id = lessons.id) AS learning_attempt_count,
              (SELECT checked_at FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_checked_at
            FROM lessons ORDER BY updated_at DESC LIMIT ?
          `)
          .all(limit) as Row[]);
    return rows.map(toReceipt);
  }

  getLesson(id: string): StoredLesson {
    const row = this.db
      .prepare(`
        SELECT lessons.*,
          (SELECT result FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_result,
          (SELECT stage FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_stage,
          (SELECT COUNT(*) FROM lesson_outcomes WHERE lesson_id = lessons.id) AS learning_attempt_count,
          (SELECT checked_at FROM lesson_outcomes WHERE lesson_id = lessons.id ORDER BY checked_at DESC LIMIT 1) AS learning_checked_at
        FROM lessons WHERE lessons.id = ?
      `)
      .get(id) as Row | undefined;
    if (!row) throw new Error("Lesson not found");
    return { ...toReceipt(row), presentation: JSON.parse(String(row.presentation_json)) };
  }

  deleteLesson(id: string): void {
    this.db.prepare("DELETE FROM lessons WHERE id = ?").run(id);
  }

  deleteAll(): void {
    this.db.exec("BEGIN; DELETE FROM lessons; DELETE FROM memories; COMMIT;");
  }

  setFeedback(id: string, helpful: boolean): void {
    this.db
      .prepare("UPDATE lessons SET helpful = ?, updated_at = ? WHERE id = ?")
      .run(helpful ? 1 : 0, new Date().toISOString(), id);
  }

  recordLearningOutcome(
    lessonId: string,
    stage: LearningCheckStage,
    response: string,
    evaluation: LearningCheckEvaluation,
  ): LearningOutcome {
    const lesson = this.getLesson(lessonId);
    const check = lessonCheckForStage(lesson.presentation.plan, stage);
    if (!check) throw new Error("This lesson does not have a learning check");
    const checkedAt = new Date().toISOString();
    const attemptNumber =
      Number(
        (
          this.db
            .prepare(
              "SELECT COUNT(*) AS count FROM lesson_outcomes WHERE lesson_id = ? AND stage = ?",
            )
            .get(lessonId, stage) as Row
        ).count,
      ) + 1;
    const outcome: LearningOutcome = {
      id: crypto.randomUUID(),
      lessonId,
      prompt: check.prompt,
      response: response.trim().slice(0, 500),
      checkKind: check.kind,
      stage,
      attemptNumber,
      checkedAt,
      verifier: "local-plan-key",
      ...evaluation,
    };
    this.db
      .prepare(`
        INSERT INTO lesson_outcomes(
          id, lesson_id, checked_at, prompt, response, check_kind, stage, attempt_number,
          result, feedback, matched_json, verifier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        outcome.id,
        outcome.lessonId,
        outcome.checkedAt,
        outcome.prompt,
        outcome.response,
        outcome.checkKind,
        outcome.stage,
        outcome.attemptNumber,
        outcome.result,
        outcome.feedback,
        JSON.stringify(outcome.matched),
        outcome.verifier,
      );
    if (outcome.result === "correct" && stage === "transfer") {
      this.upsertMemory("feedback", lesson.concept, "immediate-transfer-observed", 0.5);
    } else if (outcome.result === "correct") {
      this.upsertMemory("feedback", lesson.concept, "guided-try-correct", 0.25);
    }
    return outcome;
  }

  listLearningOutcomes(lessonId?: string): LearningOutcome[] {
    const rows = lessonId
      ? (this.db
          .prepare("SELECT * FROM lesson_outcomes WHERE lesson_id = ? ORDER BY checked_at DESC")
          .all(lessonId) as Row[])
      : (this.db.prepare("SELECT * FROM lesson_outcomes ORDER BY checked_at DESC").all() as Row[]);
    return rows.map(toLearningOutcome);
  }

  upsertMemory(
    kind: LearningMemory["kind"],
    topic: string,
    value: string,
    strength = 1,
  ): LearningMemory {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare("SELECT * FROM memories WHERE kind = ? AND topic = ? AND value = ?")
      .get(kind, topic, value) as Row | undefined;
    const id = existing ? String(existing.id) : crypto.randomUUID();
    const nextStrength = Math.min(10, (existing ? Number(existing.strength) : 0) + strength);
    this.db
      .prepare(`
        INSERT INTO memories(id, kind, topic, value, strength, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET strength = excluded.strength,
          updated_at = excluded.updated_at
      `)
      .run(
        id,
        kind,
        topic,
        value,
        nextStrength,
        existing?.created_at === undefined ? now : String(existing.created_at),
        now,
      );
    return this.getMemory(id);
  }

  listMemories(query = ""): LearningMemory[] {
    const rows = query.trim()
      ? (this.db
          .prepare(`
            SELECT * FROM memories WHERE topic LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\'
            ORDER BY strength DESC, updated_at DESC
          `)
          .all("%" + escapeLike(query.trim()) + "%", "%" + escapeLike(query.trim()) + "%") as Row[])
      : (this.db
          .prepare("SELECT * FROM memories ORDER BY strength DESC, updated_at DESC")
          .all() as Row[]);
    return rows.map(toMemory);
  }

  deleteMemory(id: string): void {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  memorySummary(): MemorySummary {
    const lessonCount = Number(
      (this.db.prepare("SELECT COUNT(*) AS count FROM lessons").get() as Row).count,
    );
    const memoryCount = Number(
      (this.db.prepare("SELECT COUNT(*) AS count FROM memories").get() as Row).count,
    );
    const concepts = this.db
      .prepare(
        "SELECT concept, COUNT(*) AS count FROM lessons GROUP BY concept ORDER BY count DESC LIMIT 5",
      )
      .all() as Row[];
    const dates = (
      this.db
        .prepare("SELECT DISTINCT substr(created_at, 1, 10) AS day FROM lessons ORDER BY day DESC")
        .all() as Row[]
    ).map((row) => String(row.day));
    const today = localDateKey(new Date());
    return {
      lessonCount,
      memoryCount,
      currentStreak: calculateStreak(dates),
      studiedToday: dates.includes(today),
      topConcepts: concepts.map((row) => ({
        concept: String(row.concept),
        count: Number(row.count),
      })),
      explicitPreferences: this.listMemories()
        .filter((item) => item.kind === "preference")
        .slice(0, 8),
    };
  }

  exportData(): {
    exportedAt: string;
    lessons: StoredLesson[];
    memories: LearningMemory[];
    learningOutcomes: LearningOutcome[];
    settings: AppSettings;
  } {
    return {
      exportedAt: new Date().toISOString(),
      lessons: this.listLessons("", 10_000).map((lesson) => this.getLesson(lesson.id)),
      memories: this.listMemories(),
      learningOutcomes: this.listLearningOutcomes(),
      settings: this.getSettings(),
    };
  }

  private getMemory(id: string): LearningMemory {
    const row = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as Row | undefined;
    if (!row) throw new Error("Memory not found");
    return toMemory(row);
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toReceipt(row: Row): LessonReceipt {
  const helpful =
    row.helpful === null || row.helpful === undefined ? undefined : Number(row.helpful) === 1;
  const learningResult =
    row.learning_result === "correct" || row.learning_result === "retry"
      ? row.learning_result
      : undefined;
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    title: String(row.title),
    concept: String(row.concept),
    question: String(row.question),
    provider: String(row.provider) as LessonReceipt["provider"],
    model: String(row.model),
    confidence: String(row.confidence) as LessonReceipt["confidence"],
    citationCount: Number(row.citation_count),
    sourceDescription: String(row.source_description),
    teachingMode: String(row.teaching_mode) as LessonReceipt["teachingMode"],
    ...(helpful === undefined ? {} : { helpful }),
    ...(learningResult && row.learning_checked_at
      ? {
          learningEvidence: {
            result: learningResult,
            stage: row.learning_stage === "transfer" ? "transfer" : "try",
            attemptCount: Number(row.learning_attempt_count ?? 0),
            checkedAt: String(row.learning_checked_at),
            verifier: "local-plan-key" as const,
          },
        }
      : {}),
  };
}

function toLearningOutcome(row: Row): LearningOutcome {
  return {
    id: String(row.id),
    lessonId: String(row.lesson_id),
    prompt: String(row.prompt),
    response: String(row.response),
    checkKind: String(row.check_kind) as LearningOutcome["checkKind"],
    stage: row.stage === "transfer" ? "transfer" : "try",
    result: String(row.result) as LearningOutcome["result"],
    feedback: String(row.feedback),
    matched: JSON.parse(String(row.matched_json)) as string[],
    attemptNumber: Number(row.attempt_number),
    checkedAt: String(row.checked_at),
    verifier: "local-plan-key",
  };
}

function toMemory(row: Row): LearningMemory {
  return {
    id: String(row.id),
    kind: String(row.kind) as LearningMemory["kind"],
    topic: String(row.topic),
    value: String(row.value),
    strength: Number(row.strength),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function calculateStreak(sortedIsoDates: string[]): number {
  if (sortedIsoDates.length === 0) return 0;
  const dates = new Set(sortedIsoDates);
  const cursor = new Date();
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
