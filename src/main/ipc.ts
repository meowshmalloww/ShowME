import { writeFile } from "node:fs/promises";
import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  shell,
  systemPreferences,
} from "electron";
import { CommandError, toCommandError } from "../shared/errors";
import {
  type AdaptLessonInput,
  type AudioInput,
  type CaptureCommitInput,
  CHANNELS,
  type IpcResult,
} from "../shared/ipc";
import { providerSummaries } from "../shared/providers";
import { providerIdSchema } from "../shared/schema";
import type {
  AppSettings,
  LauncherMode,
  LessonSurface,
  ProviderId,
  VoiceActivityState,
  WakeListenerStatus,
} from "../shared/types";
import type { CaptureService } from "./capture";
import type { LessonService } from "./lesson";
import { searchCommons } from "./media";
import type { ProviderService } from "./providers";
import type { SecretStore } from "./secrets";
import type { AppStore } from "./store";
import type { WindowManager } from "./windows";
import type { WorkerService } from "./workers";

interface IpcDependencies {
  store: AppStore;
  secrets: SecretStore;
  capture: CaptureService;
  providers: ProviderService;
  lessons: LessonService;
  windows: WindowManager;
  workers: WorkerService;
  appVersion: string;
  onSettingsChanged: (settings: AppSettings) => void;
  onVoiceActivity: (state: VoiceActivityState) => void;
  getWakeStatus: () => WakeListenerStatus;
}

export function registerIpc(dependencies: IpcDependencies): void {
  const { store, secrets, capture, providers, lessons, windows, workers } = dependencies;

  handle(CHANNELS.appBootstrap, async () => {
    const settings = store.getSettings();
    return {
      settings,
      providers: providerSummaries(settings, secrets.configured()),
      recentLessons: store.listLessons("", 8),
      memorySummary: store.memorySummary(),
      permissions: permissionStatus(capture),
      platform: process.platform,
      appVersion: dependencies.appVersion,
      captureSupported:
        process.platform === "win32" ||
        process.platform === "darwin" ||
        process.platform === "linux",
      workers: workers.status(),
      wakeListener: dependencies.getWakeStatus(),
      credentialProtection: secrets.protectionStatus(),
    };
  });

  handle(CHANNELS.appOpenMain, async (_event, section?: "home" | "library" | "settings") => {
    windows.openMain(section ?? "home");
  });
  handle(CHANNELS.appHideWindow, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.hide();
  });
  handle(CHANNELS.appWindowAction, async (event, action: "minimize" | "maximize" | "close") => {
    windows.windowAction(event.sender, action);
  });
  handle(CHANNELS.appOpenExternal, async (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new CommandError("UNSAFE_URL", "ShowME only opens HTTP or HTTPS links.");
    }
    await shell.openExternal(url.toString());
  });

  handle(CHANNELS.settingsSave, async (_event, settings: AppSettings) => {
    const saved = store.saveSettings(settings);
    dependencies.onSettingsChanged(saved);
    windows.broadcastSettings(saved);
    return bootstrapSnapshot(dependencies);
  });

  handle(CHANNELS.captureBegin, async () => {
    const payload = await capture.begin();
    windows.openSelection(payload.display.id);
    return payload;
  });
  handle(CHANNELS.captureVoiceContext, async () => {
    const prepared = await capture.captureVoiceContext();
    windows.showQuestion(prepared);
    return prepared;
  });
  handle(CHANNELS.capturePending, async () => capture.pending());
  handle(CHANNELS.captureCommit, async (_event, input: CaptureCommitInput) => {
    const prepared = await capture.commit(input.captureId, input.regions);
    windows.showQuestion(prepared);
    return prepared;
  });
  handle(CHANNELS.captureCancel, async () => {
    capture.cancel();
    windows.closeSelection();
    windows.setLauncherMode("revealed");
    windows.showLauncher();
  });
  handle(CHANNELS.capturePrepared, async () => capture.prepared());
  handle(CHANNELS.captureClear, async () => capture.clear());
  handle(CHANNELS.launcherSetMode, async (_event, mode: LauncherMode) => {
    if (
      ![
        "idle",
        "revealed",
        "question",
        "thinking",
        "listening",
        "transcribing",
        "speaking",
      ].includes(mode)
    ) {
      throw new CommandError("INVALID_MODE", "Unknown launcher mode.");
    }
    windows.setLauncherMode(mode);
  });

  handle(CHANNELS.providerSaveKey, async (_event, rawProvider: ProviderId, key: string) => {
    const provider = providerIdSchema.parse(rawProvider);
    secrets.set(provider, key);
  });
  handle(CHANNELS.providerDeleteKey, async (_event, rawProvider: ProviderId) => {
    secrets.delete(providerIdSchema.parse(rawProvider));
  });
  handle(CHANNELS.providerTest, async (_event, rawProvider: ProviderId, model: string) =>
    providers.test(providerIdSchema.parse(rawProvider), String(model).slice(0, 240)),
  );
  handle(CHANNELS.providerModels, async (_event, rawProvider: ProviderId) =>
    providers.listModels(providerIdSchema.parse(rawProvider)),
  );

  handle(CHANNELS.lessonGenerate, async (_event, request) => {
    windows.setLauncherMode("thinking");
    try {
      const result = await lessons.generate(request);
      windows.showLesson(result.presentation);
      windows.setLauncherMode("idle");
      windows.showLauncher();
      return result;
    } catch (error) {
      windows.setLauncherMode("question");
      throw error;
    }
  });
  handle(CHANNELS.lessonAdapt, async (_event, input: AdaptLessonInput) => {
    const result = await lessons.adapt(input.presentation, input.adaptation, input.question);
    windows.showLesson(result.presentation);
    return result;
  });
  handle(CHANNELS.lessonCancel, async (_event, requestId: string) =>
    lessons.cancel(String(requestId)),
  );
  handle(CHANNELS.lessonOpenSaved, async (_event, id: string) => {
    const stored = store.getLesson(String(id));
    windows.showLesson(stored.presentation);
    return stored;
  });
  handle(CHANNELS.lessonSetSurface, async (_event, surface: LessonSurface) => {
    if (!["inline", "side", "focus"].includes(surface))
      throw new CommandError("INVALID_SURFACE", "Unknown lesson surface.");
    windows.setLessonSurface(surface);
  });
  handle(CHANNELS.lessonClose, async () => windows.closeLesson());

  handle(CHANNELS.voiceTranscribe, async (_event, input: AudioInput) => {
    const settings = store.getSettings();
    return providers.transcribe(
      settings.voiceInputProvider,
      input.bytes,
      input.mimeType,
      settings.language,
    );
  });
  handle(CHANNELS.voiceSynthesize, async (_event, text: string) => {
    const settings = store.getSettings();
    if (settings.voiceOutputProvider !== "openai") {
      throw new CommandError(
        "SYSTEM_VOICE_LOCAL",
        "System voice is synthesized locally in the lesson window.",
      );
    }
    return providers.synthesize(String(text), settings.voice, settings.speechRate);
  });
  handle(CHANNELS.voiceActivity, async (_event, state: VoiceActivityState) => {
    if (!["idle", "listening", "transcribing", "speaking"].includes(state)) {
      throw new CommandError("INVALID_VOICE_STATE", "Unknown voice activity state.");
    }
    dependencies.onVoiceActivity(state);
  });

  handle(CHANNELS.memoryListLessons, async (_event, query?: string) =>
    store.listLessons(query ?? ""),
  );
  handle(CHANNELS.memoryGetLesson, async (_event, id: string) => store.getLesson(String(id)));
  handle(CHANNELS.memoryDeleteLesson, async (_event, id: string) => store.deleteLesson(String(id)));
  handle(CHANNELS.memoryDeleteAll, async () => store.deleteAll());
  handle(CHANNELS.memoryExport, async () => {
    const result = await dialog.showSaveDialog({
      title: "Export ShowME learning data",
      defaultPath: "showme-export-" + new Date().toISOString().slice(0, 10) + ".json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, JSON.stringify(store.exportData(), null, 2), "utf8");
    return result.filePath;
  });
  handle(CHANNELS.memoryFeedback, async (_event, id: string, helpful: boolean) =>
    store.setFeedback(String(id), Boolean(helpful)),
  );
  handle(CHANNELS.memoryList, async (_event, query?: string) => store.listMemories(query ?? ""));
  handle(CHANNELS.memoryDelete, async (_event, id: string) => store.deleteMemory(String(id)));
  handle(CHANNELS.memorySummary, async () => store.memorySummary());

  handle(CHANNELS.mediaSearch, async (_event, query: string) => searchCommons(String(query)));
  handle(CHANNELS.permissionsStatus, async () => permissionStatus(capture));
  handle(CHANNELS.permissionsRequestMicrophone, async () => {
    if (process.platform === "darwin") await systemPreferences.askForMediaAccess("microphone");
    return permissionStatus(capture);
  });
}

function handle<T>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T> | T,
): void {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
    try {
      assertTrustedSender(event);
      return { ok: true, data: await listener(event, ...args) };
    } catch (error) {
      return { ok: false, error: toCommandError(error) };
    }
  });
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const source = event.senderFrame?.url ?? event.sender.getURL();
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  const trusted =
    source.startsWith("file://") || Boolean(developmentUrl && source.startsWith(developmentUrl));
  if (!trusted)
    throw new CommandError("UNTRUSTED_IPC_SENDER", "Blocked an untrusted window request.");
}

function permissionStatus(capture: CaptureService) {
  const microphone =
    process.platform === "darwin"
      ? mapMediaStatus(systemPreferences.getMediaAccessStatus("microphone"))
      : "unknown";
  return {
    capture: capture.permissionStatus(),
    microphone,
    note:
      process.platform === "darwin"
        ? "macOS may require Screen Recording and Microphone permission before first use."
        : "On Windows, the optional ShowME wake phrase is recognized locally. Cloud transcription starts only after ShowME wakes or you press the voice button.",
  } as const;
}

function mapMediaStatus(status: string): "unknown" | "granted" | "denied" | "unsupported" {
  if (status === "granted") return "granted";
  if (status === "denied" || status === "restricted") return "denied";
  return "unknown";
}

function bootstrapSnapshot(dependencies: IpcDependencies) {
  const settings = dependencies.store.getSettings();
  return {
    settings,
    providers: providerSummaries(settings, dependencies.secrets.configured()),
    recentLessons: dependencies.store.listLessons("", 8),
    memorySummary: dependencies.store.memorySummary(),
    permissions: permissionStatus(dependencies.capture),
    platform: process.platform,
    appVersion: dependencies.appVersion,
    captureSupported: true,
    workers: dependencies.workers.status(),
    wakeListener: dependencies.getWakeStatus(),
    credentialProtection: dependencies.secrets.protectionStatus(),
  };
}
