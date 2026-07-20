// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { AppStore } from "../src/main/store";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";

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
    const legacy = { ...DEFAULT_SETTINGS, accent: "coral", wakeEnabled: true };
    database.prepare("UPDATE settings SET value_json = ? WHERE id = 1").run(JSON.stringify(legacy));
    database.close();

    const migrated = new AppStore(databasePath);
    expect(migrated.getSettings().assistantName).toBe("ShowME");
    expect(migrated.getSettings()).not.toHaveProperty("accent");
    expect(migrated.getSettings().wakeEnabled).toBe(true);
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
});
