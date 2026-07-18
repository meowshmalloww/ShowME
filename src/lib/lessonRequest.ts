import type { AppSettings, GenerateLessonRequest, PreparedContext, ProviderSummary } from "./types";

export interface LessonRequestOptions {
  copiedText: string;
  sourceUrl: string;
  nearby: boolean;
  activeWindow: boolean;
  research: boolean;
  imageAids: boolean;
}

export function buildLessonRequest(
  context: PreparedContext,
  settings: AppSettings,
  provider: ProviderSummary,
  question: string,
  options: LessonRequestOptions,
): GenerateLessonRequest {
  return {
    captureId: context.captureId,
    question: question.trim(),
    copiedText: options.copiedText.trim() || undefined,
    sourceUrl: options.sourceUrl.trim() || undefined,
    includeNearbyContext: options.nearby && provider.capabilities.vision,
    includeActiveWindow: options.activeWindow && provider.capabilities.vision,
    allowWebResearch: options.research && provider.capabilities.webSearch,
    allowImageAids: options.imageAids,
    language: settings.language,
    teachingStyle: settings.teachingStyle,
    complexity: "standard",
    provider: provider.id,
    model: provider.model,
  };
}
