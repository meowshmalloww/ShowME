// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { AppStore } from "../src/main/store";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import type { LessonPresentation } from "../src/shared/types";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("local SQLite product state", () => {
  it("persists settings and explicit learning memory", () => {
    const directory = mkdtempSync(join(tmpdir(), "showme-store-"));
    temporaryDirectories.push(directory);
    const store = new AppStore(join(directory, "showme.sqlite3"));
    const settings = { ...DEFAULT_SETTINGS, onboardingComplete: true, assistantName: "Ada" };
    store.saveSettings(settings);
    store.upsertMemory("preference", "teaching-style", "step-by-step");
    expect(store.getSettings().assistantName).toBe("ShowME");
    expect(store.memorySummary().memoryCount).toBe(1);
    expect(store.listMemories()[0]?.value).toBe("step-by-step");
    store.close();
  });

  it("migrates the disconnected appearance flag and retains the wake preference", () => {
    const directory = mkdtempSync(join(tmpdir(), "showme-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "showme.sqlite3");
    const store = new AppStore(databasePath);
    store.saveSettings({ ...DEFAULT_SETTINGS, onboardingComplete: true, assistantName: "Ada" });
    store.close();

    const database = new DatabaseSync(databasePath);
    const legacy = {
      ...DEFAULT_SETTINGS,
      accent: "coral",
      wakeEnabled: true,
      voiceSilenceMs: 2200,
    };
    database.prepare("UPDATE settings SET value_json = ? WHERE id = 1").run(JSON.stringify(legacy));
    database.close();

    const migrated = new AppStore(databasePath);
    expect(migrated.getSettings().assistantName).toBe("ShowME");
    expect(migrated.getSettings()).not.toHaveProperty("accent");
    expect(migrated.getSettings().wakeEnabled).toBe(true);
    expect(migrated.getSettings().voiceSilenceMs).toBe(3500);
    migrated.close();
  });

  it("moves the retired NVIDIA preview default to a current verified VLM", () => {
    const directory = mkdtempSync(join(tmpdir(), "showme-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "showme.sqlite3");
    const store = new AppStore(databasePath);
    store.saveSettings(DEFAULT_SETTINGS);
    store.close();

    const database = new DatabaseSync(databasePath);
    const legacy = {
      ...DEFAULT_SETTINGS,
      models: {
        ...DEFAULT_SETTINGS.models,
        nvidia: "meta/llama-4-maverick-17b-128e-instruct",
      },
      textModels: {
        ...DEFAULT_SETTINGS.textModels,
        nvidia: "meta/llama-4-maverick-17b-128e-instruct",
      },
    };
    database.prepare("UPDATE settings SET value_json = ? WHERE id = 1").run(JSON.stringify(legacy));
    database.close();

    const migrated = new AppStore(databasePath);
    expect(migrated.getSettings().models.nvidia).toBe("nvidia/nemotron-nano-12b-v2-vl");
    expect(migrated.getSettings().textModels.nvidia).toBe("nvidia/nemotron-nano-12b-v2-vl");
    migrated.close();
  });

  it("never persists the private in-memory screen preview", () => {
    const directory = mkdtempSync(join(tmpdir(), "showme-store-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "showme.sqlite3");
    const store = new AppStore(databasePath);
    const presentation: LessonPresentation = {
      plan: {
        version: 1,
        id: "private-preview-test",
        title: "Private preview test",
        concept: "Ephemeral visual context",
        summary: "The explanation remains, while the captured pixels do not.",
        teachingMode: "diagram-annotation",
        confidence: "exploratory",
        sourceDescription: "Selected screen region",
        narration: "This lesson is intentionally minimal.",
        primitives: [],
        steps: [
          {
            id: "step-1",
            title: "Inspect the selection",
            narration: "Look at the selected region.",
            primitiveIds: [],
            durationMs: 1_000,
          },
        ],
        controls: [],
        claims: [],
        citations: [],
        followUps: [],
        provider: { id: "openai", model: "gpt-5.6-sol" },
      },
      request: {
        captureId: "capture-private-preview",
        question: "What is visible?",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "step-by-step",
        complexity: "standard",
        provider: "openai",
        model: "gpt-5.6-sol",
      },
      verification: {
        verified: false,
        engine: "none",
        summary: "Model inference only.",
        details: {},
      },
      createdAt: new Date().toISOString(),
      surface: "side",
      contextPreviewDataUrl: "data:image/png;base64,privatepixels",
      contextPreviewExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    store.saveLesson(presentation);
    const saved = store.getLesson(presentation.plan.id);
    expect(saved?.presentation.contextPreviewDataUrl).toBeUndefined();
    expect(saved?.presentation.contextPreviewExpiresAt).toBeUndefined();
    store.close();

    const database = new DatabaseSync(databasePath);
    const row = database
      .prepare("SELECT presentation_json FROM lessons WHERE id = ?")
      .get(presentation.plan.id) as { presentation_json: string };
    expect(row.presentation_json).not.toContain("privatepixels");
    database.close();
  });
});
