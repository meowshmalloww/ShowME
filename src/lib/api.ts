import { invoke } from "@tauri-apps/api/core";
import { normalizeCommandError } from "./errors";
import type {
  AppBootstrap,
  AppSettings,
  CapturePayload,
  GenerateLessonRequest,
  ImageAsset,
  LessonPlan,
  LessonPresentation,
  LessonReceipt,
  PermissionStatus,
  PreparedContext,
  ProviderId,
  ProviderSummary,
  SelectionRegion,
  StoredLesson,
} from "./types";

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

export const desktop = {
  bootstrap: () => command<AppBootstrap>("bootstrap"),
  saveSettings: (settings: AppSettings) => command<AppBootstrap>("save_settings", { settings }),
  providerSummaries: () => command<ProviderSummary[]>("provider_summaries"),
  setProviderKey: (provider: ProviderId, key: string) =>
    command<ProviderSummary[]>("set_provider_key", { provider, key }),
  deleteProviderKey: (provider: ProviderId) =>
    command<ProviderSummary[]>("delete_provider_key", { provider }),
  testProvider: (provider: ProviderId, model: string) =>
    command<string>("test_provider", { provider, model }),
  beginCapture: () => command<CapturePayload>("begin_capture"),
  pendingCapture: () => command<CapturePayload>("get_pending_capture"),
  commitSelection: (captureId: string, regions: SelectionRegion[]) =>
    command<PreparedContext>("commit_selection", { captureId, regions }),
  cancelCapture: () => command<void>("cancel_capture"),
  preparedContext: () => command<PreparedContext | null>("get_prepared_context"),
  generateLesson: (request: GenerateLessonRequest) =>
    command<LessonPlan>("generate_lesson", { request }),
  presentLesson: (presentation: LessonPresentation) =>
    command<void>("present_lesson", { presentation }),
  setPetExpanded: (expanded: boolean) => command<void>("set_pet_expanded", { expanded }),
  endLessonContext: () => command<void>("end_lesson_context"),
  transcribe: (mimeType: string, audioBase64: string) =>
    command<string>("transcribe_audio", { mimeType, audioBase64 }),
  synthesize: (text: string, voice: string, speed: number) =>
    command<string>("synthesize_speech", { text, voice, speed }),
  searchImages: (query: string) => command<ImageAsset[]>("search_commons_images", { query }),
  listLessons: () => command<LessonReceipt[]>("list_lessons"),
  getLesson: (id: string) => command<StoredLesson>("get_lesson", { id }),
  deleteLesson: (id: string) => command<void>("delete_lesson", { id }),
  deleteAllMemory: () => command<void>("delete_all_memory"),
  exportMemory: () => command<string>("export_memory"),
  setLessonFeedback: (id: string, helpful: boolean) =>
    command<void>("set_lesson_feedback", { id, helpful }),
  checkCapturePermission: () => command<PermissionStatus>("check_capture_permission"),
  showMain: (section?: string) => command<void>("show_main", { section }),
  hideMain: () => command<void>("hide_main"),
  windowAction: (action: "minimize" | "close" | "hide") =>
    command<void>("window_action", { action }),
  openExternal: (url: string) => command<void>("open_external", { url }),
};

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}
