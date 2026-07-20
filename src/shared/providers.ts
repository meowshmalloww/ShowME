import { DEFAULT_MODELS, DEFAULT_TEXT_MODELS } from "./defaults";
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
      speechToText: true,
      textToSpeech: true,
      streaming: true,
      tools: true,
    },
    capabilityNote:
      "Reference path with GPT-5.6 vision, strict lesson plans, and optional web research.",
  },
  alibaba: {
    id: "alibaba",
    name: "Alibaba Cloud Qwen",
    shortName: "QW",
    baseUrl: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions",
    modelsUrl: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/models",
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
      "US Model Studio route. Vision and JSON support depend on the selected Qwen model.",
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
      "OpenAI-compatible NIM route; exact vision and schema support are model-specific.",
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
      "Fast inference and transcription. Groq is not xAI's Grok; capabilities vary by model.",
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
      "Very fast strict structured planning; image-input support is preview and model-specific.",
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
