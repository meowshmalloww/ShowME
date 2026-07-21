import type {
  AdaptationKind,
  AppBootstrap,
  AppSettings,
  AudioProviderId,
  CapturePayload,
  CredentialId,
  GenerateLessonRequest,
  ImageAsset,
  LauncherMode,
  LearningMemory,
  LessonPresentation,
  LessonProgress,
  LessonReceipt,
  LessonSurface,
  MemorySummary,
  PermissionStatus,
  PreparedContext,
  ProviderId,
  ProviderModel,
  SelectionRegion,
  SpokenLessonCommandEvent,
  StoredLesson,
  VoiceActivityState,
  WakeListenerStatus,
} from "./types";

export const CHANNELS = {
  appBootstrap: "app:bootstrap",
  appOpenMain: "app:open-main",
  appHideWindow: "app:hide-window",
  appWindowAction: "app:window-action",
  appOpenExternal: "app:open-external",
  settingsSave: "settings:save",
  captureBegin: "capture:begin",
  captureVoiceContext: "capture:voice-context",
  capturePending: "capture:pending",
  captureCommit: "capture:commit",
  captureCancel: "capture:cancel",
  capturePrepared: "capture:prepared",
  captureClear: "capture:clear",
  launcherSetMode: "launcher:set-mode",
  providerSaveKey: "provider:save-key",
  providerDeleteKey: "provider:delete-key",
  providerTest: "provider:test",
  providerModels: "provider:models",
  lessonGenerate: "lesson:generate",
  lessonAdapt: "lesson:adapt",
  lessonCancel: "lesson:cancel",
  lessonOpenSaved: "lesson:open-saved",
  lessonSetSurface: "lesson:set-surface",
  lessonClose: "lesson:close",
  voiceTranscribe: "voice:transcribe",
  voiceSynthesize: "voice:synthesize",
  voiceTestProvider: "voice:test-provider",
  voiceActivity: "voice:activity",
  wakeAudio: "wake:audio",
  wakeInputState: "wake:input-state",
  memoryListLessons: "memory:list-lessons",
  memoryGetLesson: "memory:get-lesson",
  memoryDeleteLesson: "memory:delete-lesson",
  memoryDeleteAll: "memory:delete-all",
  memoryExport: "memory:export",
  memoryFeedback: "memory:feedback",
  memoryList: "memory:list",
  memoryDelete: "memory:delete",
  memorySummary: "memory:summary",
  mediaSearch: "media:search",
  permissionsStatus: "permissions:status",
  permissionsRequestMicrophone: "permissions:request-microphone",
  eventNavigate: "event:navigate",
  eventContextReady: "event:context-ready",
  eventLessonProgress: "event:lesson-progress",
  eventLessonReady: "event:lesson-ready",
  eventLauncherMode: "event:launcher-mode",
  eventVoiceLevel: "event:voice-level",
  eventWakeDetected: "event:wake-detected",
  eventWakeStatus: "event:wake-status",
  eventSettingsChanged: "event:settings-changed",
  eventVoiceCommand: "event:voice-command",
} as const;

export type IpcChannel = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface IpcSuccess<T> {
  ok: true;
  data: T;
}

export interface IpcFailure {
  ok: false;
  error: { code: string; message: string; remediation?: string };
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure;

export interface CaptureCommitInput {
  captureId: string;
  regions: SelectionRegion[];
}

export interface AudioInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface WakeInputState {
  state: "starting" | "ready" | "error" | "stopped";
  message: string;
  deviceLabel?: string;
}

export interface AdaptLessonInput {
  presentation: LessonPresentation;
  adaptation: AdaptationKind;
  question?: string;
}

export interface LessonGenerateResult {
  requestId: string;
  presentation: LessonPresentation;
}

export interface ShowMEApi {
  app: {
    bootstrap(): Promise<AppBootstrap>;
    openMain(section?: "home" | "library" | "settings"): Promise<void>;
    hideWindow(): Promise<void>;
    windowAction(action: "minimize" | "maximize" | "close"): Promise<void>;
    openExternal(url: string): Promise<void>;
  };
  settings: {
    save(settings: AppSettings): Promise<AppBootstrap>;
  };
  capture: {
    begin(): Promise<CapturePayload>;
    voiceContext(): Promise<PreparedContext>;
    pending(): Promise<CapturePayload>;
    commit(input: CaptureCommitInput): Promise<PreparedContext>;
    cancel(): Promise<void>;
    prepared(): Promise<PreparedContext | null>;
    clear(): Promise<void>;
  };
  launcher: {
    setMode(mode: LauncherMode): Promise<void>;
  };
  providers: {
    saveKey(provider: CredentialId, key: string): Promise<void>;
    deleteKey(provider: CredentialId): Promise<void>;
    test(provider: ProviderId, model: string): Promise<string>;
    models(provider: ProviderId): Promise<ProviderModel[]>;
  };
  lesson: {
    generate(request: GenerateLessonRequest): Promise<LessonGenerateResult>;
    adapt(input: AdaptLessonInput): Promise<LessonGenerateResult>;
    cancel(requestId: string): Promise<void>;
    openSaved(id: string): Promise<StoredLesson>;
    setSurface(surface: LessonSurface): Promise<void>;
    close(): Promise<void>;
  };
  voice: {
    transcribe(input: AudioInput): Promise<string>;
    synthesize(text: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
    testProvider(provider: AudioProviderId): Promise<string>;
    activity(state: VoiceActivityState): Promise<void>;
  };
  wake: {
    pushAudio(bytes: Uint8Array): void;
    inputState(state: WakeInputState): void;
  };
  memory: {
    listLessons(query?: string): Promise<LessonReceipt[]>;
    getLesson(id: string): Promise<StoredLesson>;
    deleteLesson(id: string): Promise<void>;
    deleteAll(): Promise<void>;
    export(): Promise<string | null>;
    feedback(id: string, helpful: boolean): Promise<void>;
    list(query?: string): Promise<LearningMemory[]>;
    delete(id: string): Promise<void>;
    summary(): Promise<MemorySummary>;
  };
  media: {
    search(query: string): Promise<ImageAsset[]>;
  };
  permissions: {
    status(): Promise<PermissionStatus>;
    requestMicrophone(): Promise<PermissionStatus>;
  };
  events: {
    onNavigate(callback: (section: string) => void): () => void;
    onContextReady(callback: (context: PreparedContext) => void): () => void;
    onLessonProgress(callback: (progress: LessonProgress) => void): () => void;
    onLessonReady(callback: (presentation: LessonPresentation) => void): () => void;
    onLauncherMode(callback: (mode: LauncherMode) => void): () => void;
    onVoiceLevel(callback: (level: number) => void): () => void;
    onWakeDetected(callback: (context: PreparedContext) => void): () => void;
    onWakeStatus(callback: (status: WakeListenerStatus) => void): () => void;
    onSettingsChanged(callback: (settings: AppSettings) => void): () => void;
    onVoiceCommand(callback: (event: SpokenLessonCommandEvent) => void): () => void;
  };
}
