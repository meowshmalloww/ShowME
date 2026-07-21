import { DEFAULT_MODELS, DEFAULT_TEXT_MODELS, QWEN_CLOUD_DEFAULT_BASE_URL } from "./defaults";
import type { AppSettings, ProviderCapabilities, ProviderId, ProviderSummary } from "./types";

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  shortName: string;
  baseUrl: string;
  modelsUrl: string;
  capabilities: ProviderCapabilities;
  capabilityNote: string;
}

export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    shortName: "OA",
    baseUrl: "https://api.openai.com/v1/responses",
    modelsUrl: "https://api.openai.com/v1/models",
    capabilities: {
      vision: true,
      structuredOutput: true,
      webSearch: true,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "Reference path with GPT-5.6 vision, strict lesson plans, and optional web research.",
  },
  google: {
    id: "google",
    name: "Google AI Studio",
    shortName: "GM",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    capabilities: {
      vision: true,
      structuredOutput: true,
      webSearch: false,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: false,
    },
    capabilityNote:
      "Native Gemini multimodal route with streamed structured lesson plans and low-thinking Flash defaults for fast screen explanations.",
  },
  alibaba: {
    id: "alibaba",
    name: "Qwen Cloud",
    shortName: "QW",
    baseUrl: QWEN_CLOUD_DEFAULT_BASE_URL + "/chat/completions",
    modelsUrl: QWEN_CLOUD_DEFAULT_BASE_URL + "/models",
    capabilities: {
      vision: true,
      structuredOutput: false,
      webSearch: false,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "Qwen Cloud uses the API Host paired with your pay-as-you-go, Token Plan, or Coding Plan key. Vision and JSON support are model-specific.",
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    shortName: "NV",
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    modelsUrl: "https://integrate.api.nvidia.com/v1/models",
    capabilities: {
      vision: true,
      structuredOutput: false,
      webSearch: false,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "OpenAI-compatible NIM route. Catalog results do not guarantee free or organization-level access; verify the exact model.",
  },
  groq: {
    id: "groq",
    name: "Groq",
    shortName: "GQ",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    capabilities: {
      vision: true,
      structuredOutput: true,
      webSearch: false,
      speechToText: true,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "Fast inference and transcription. Strict schemas are limited to GPT-OSS; other models use validated JSON mode.",
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    shortName: "CB",
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    capabilities: {
      vision: false,
      structuredOutput: true,
      webSearch: false,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "Very fast planning. Gemma 4 31B supports screenshot input; other Cerebras models remain text-only unless their catalog metadata says otherwise.",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OR",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    capabilities: {
      vision: true,
      structuredOutput: true,
      webSearch: false,
      speechToText: false,
      textToSpeech: false,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "A routed model must explicitly support image input and strict structured output.",
  },
};

export function normalizeQwenCloudBaseUrl(raw: string): string {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter the OpenAI-compatible API Host shown by Qwen Cloud.");
  }
  const hostname = url.hostname.toLowerCase();
  const qwenHost =
    /^dashscope(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(hostname) ||
    /^[a-z0-9-]+\.dashscope\.aliyuncs\.com$/.test(hostname) ||
    /(^|\.)maas\.aliyuncs\.com$/.test(hostname);
  if (
    url.protocol !== "https:" ||
    !qwenHost ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Use an HTTPS Qwen Cloud API Host on aliyuncs.com.");
  }
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/(?:chat\/completions|models)$/, "");
  if (!pathname.endsWith("/compatible-mode/v1") && !pathname.endsWith("/v1")) {
    throw new Error("The Qwen Cloud API Host must end in /compatible-mode/v1 or /v1.");
  }
  return url.origin + pathname;
}

export function isAllowedQwenCloudBaseUrl(raw: string): boolean {
  try {
    normalizeQwenCloudBaseUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function providerEndpoints(
  provider: ProviderId,
  settings?: Pick<AppSettings, "qwenBaseUrl">,
): { baseUrl: string; modelsUrl: string } {
  if (provider !== "alibaba") {
    const definition = PROVIDER_DEFINITIONS[provider];
    return { baseUrl: definition.baseUrl, modelsUrl: definition.modelsUrl };
  }
  const baseUrl = normalizeQwenCloudBaseUrl(settings?.qwenBaseUrl ?? QWEN_CLOUD_DEFAULT_BASE_URL);
  return {
    baseUrl: baseUrl + "/chat/completions",
    modelsUrl: baseUrl + "/models",
  };
}

export function effectiveCapabilities(
  provider: ProviderId,
  settings: AppSettings,
): ProviderCapabilities {
  const base = PROVIDER_DEFINITIONS[provider].capabilities;
  return { ...base, ...settings.providerCapabilityOverrides[provider] };
}

export function providerSummaries(
  settings: AppSettings,
  configured: Partial<Record<ProviderId, boolean>>,
): ProviderSummary[] {
  return Object.values(PROVIDER_DEFINITIONS).map((definition) => ({
    id: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    configured: configured[definition.id] ?? false,
    model: settings.models[definition.id] || DEFAULT_MODELS[definition.id],
    textModel: settings.textModels[definition.id] || DEFAULT_TEXT_MODELS[definition.id],
    defaultCapabilities: definition.capabilities,
    capabilities: effectiveCapabilities(definition.id, settings),
    capabilityNote: definition.capabilityNote,
  }));
}
