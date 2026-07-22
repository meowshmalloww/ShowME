import { writeFile } from "node:fs/promises";
import {
  BrowserWindow,
  dialog,
  type IpcMainEvent,
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
  type WakeInputState,
} from "../shared/ipc";
import { providerSummaries } from "../shared/providers";
import { audioProviderIdSchema, credentialIdSchema, providerIdSchema } from "../shared/schema";
import type {
  AppSettings,
  CredentialId,
  LauncherMode,
  LessonSurface,
  ProviderId,
  VoiceActivityState,
  WakeListenerStatus,
} from "../shared/types";
import { voiceServiceSummaries } from "../shared/voice";
import type { CaptureService } from "./capture";
import { prepareSavedLessonReplay, type LessonService } from "./lesson";
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
  onWakeAudio: (bytes: Uint8Array) => void;
  onWakeInputState: (state: WakeInputState) => void;
  suspendWake: () => void;
  resumeWake: () => void;
  getWakeStatus: () => WakeListenerStatus;
}

export function registerIpc(dependencies: IpcDependencies): void {
  const { store, secrets, capture, providers, lessons, windows, workers } = dependencies;

  handle(CHANNELS.appBootstrap, async () => {
    const settings = store.getSettings();
    const configured = secrets.configured();
    return {
      settings,
      providers: providerSummaries(settings, configured),
      voiceServices: voiceServiceSummaries(configured),
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
    windows.closeLesson(false);
    dependencies.suspendWake();
    try {
      const payload = await capture.begin();
      windows.openSelection(payload.display.id);
      return payload;
    } catch (error) {
      dependencies.resumeWake();
      throw error;
    }
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
    dependencies.resumeWake();
  });
  handle(CHANNELS.capturePrepared, async () => capture.prepared());
  handle(CHANNELS.captureClear, async () => {
    capture.clear();
    dependencies.resumeWake();
  });
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

  handle(CHANNELS.providerSaveKey, async (_event, rawProvider: CredentialId, key: string) => {
    const provider = credentialIdSchema.parse(rawProvider);
    secrets.set(provider, key);
  });
  handle(CHANNELS.providerDeleteKey, async (_event, rawProvider: CredentialId) => {
    secrets.delete(credentialIdSchema.parse(rawProvider));
  });
  handle(CHANNELS.providerTest, async (_event, rawProvider: ProviderId, model: string) =>
    providers.test(
      providerIdSchema.parse(rawProvider),
      String(model).slice(0, 240),
      store.getSettings(),
    ),
  );
  handle(CHANNELS.providerModels, async (_event, rawProvider: ProviderId) =>
    providers.listModels(providerIdSchema.parse(rawProvider), store.getSettings()),
  );

  handle(CHANNELS.lessonGenerate, async (_event, request) => {
    windows.setLauncherMode("thinking");
    const context = capture.getPrepared(request.captureId);
    windows.showScreenReading(context.display.id);
    try {
      const result = await lessons.generate(request);
      windows.hideScreenReading();
      windows.showLesson(result.presentation);
      windows.setLauncherMode("idle");
      windows.showLauncher();
      dependencies.onVoiceActivity("idle");
      return result;
    } catch (error) {
      windows.setLauncherMode("question");
      throw error;
    } finally {
      windows.hideScreenReading();
    }
  });
  handle(CHANNELS.lessonAdapt, async (_event, input: AdaptLessonInput) => {
    windows.setLauncherMode("thinking");
    dependencies.suspendWake();
    try {
      const result = await lessons.adapt(input.presentation, input.adaptation, input.question);
      windows.showLesson(result.presentation);
      dependencies.onVoiceActivity("idle");
      windows.showLauncher();
      return result;
    } catch (error) {
      dependencies.onVoiceActivity("idle");
      throw error;
    }
  });
  handle(CHANNELS.lessonCancel, async (_event, requestId: string) =>
    lessons.cancel(String(requestId)),
  );
  handle(CHANNELS.lessonOpenSaved, async (_event, id: string) => {
    const stored = store.getLesson(String(id));
    const presentation = prepareSavedLessonReplay(stored.presentation, store.getSettings());
    windows.showLesson(presentation);
    dependencies.onVoiceActivity("idle");
    return { ...stored, presentation };
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
    if (settings.voiceOutputProvider === "system") {
      throw new CommandError(
        "SYSTEM_VOICE_LOCAL",
        "System voice is synthesized locally in the lesson window.",
      );
    }
    return providers.synthesize(
      settings.voiceOutputProvider,
      String(text),
      settings.deepgramVoice,
      settings.elevenLabsVoice,
      settings.speechRate,
    );
  });
  handle(CHANNELS.voiceTestProvider, async (_event, rawProvider) => {
    const settings = store.getSettings();
    return providers.testSpeechService(audioProviderIdSchema.parse(rawProvider), settings);
  });
  handle(CHANNELS.voiceActivity, async (_event, state: VoiceActivityState) => {
    if (!["idle", "listening", "transcribing", "speaking"].includes(state)) {
      throw new CommandError("INVALID_VOICE_STATE", "Unknown voice activity state.");
    }
    dependencies.onVoiceActivity(state);
  });
  handle(CHANNELS.voicePlaybackError, async (_event, rawMessage: unknown) => {
    const message = String(rawMessage).replace(/\s+/g, " ").trim().slice(0, 400);
    if (message) windows.broadcastVoicePlaybackError(message);
  });

  listen(CHANNELS.wakeAudio, (event, rawBytes: unknown) => {
    if (BrowserWindow.fromWebContents(event.sender) !== windows.getLauncher()) return;
    const bytes =
      rawBytes instanceof Uint8Array
        ? rawBytes
        : rawBytes instanceof ArrayBuffer
          ? new Uint8Array(rawBytes)
          : null;
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 128_000) return;
    dependencies.onWakeAudio(bytes);
  });
  listen(CHANNELS.wakeInputState, (event, rawState: unknown) => {
    if (BrowserWindow.fromWebContents(event.sender) !== windows.getLauncher()) return;
    if (!rawState || typeof rawState !== "object") return;
    const candidate = rawState as Partial<WakeInputState>;
    if (!candidate.state || !["starting", "ready", "error", "stopped"].includes(candidate.state)) {
      return;
    }
    dependencies.onWakeInputState({
      state: candidate.state,
      message: String(candidate.message ?? "Wake microphone state changed.").slice(0, 300),
      ...(candidate.deviceLabel
        ? { deviceLabel: String(candidate.deviceLabel).slice(0, 160) }
        : {}),
    });
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

function listen(
  channel: string,
  listener: (event: IpcMainEvent, ...args: unknown[]) => void,
): void {
  ipcMain.removeAllListeners(channel);
  ipcMain.on(channel, (event, ...args) => {
    try {
      assertTrustedSender(event);
      listener(event, ...args);
    } catch {
      // One-way wake-audio events are intentionally dropped when validation fails.
    }
  });
}

function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
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
  const configured = dependencies.secrets.configured();
  return {
    settings,
    providers: providerSummaries(settings, configured),
    voiceServices: voiceServiceSummaries(configured),
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
