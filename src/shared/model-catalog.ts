import { PROVIDER_DEFINITIONS } from "./providers";
import type { AppSettings, ProviderCapabilities, ProviderId, ProviderModel } from "./types";

const NVIDIA_DEPRECATING_MODELS = new Set([
  "meta/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3.5-122b-a10b",
  "qwen/qwen3.5-397b-a17b",
  "mistralai/mistral-small-4-119b-2603",
]);

export const NVIDIA_VISION_CATALOG: readonly ProviderModel[] = [
  {
    id: "thinkingmachines/inkling",
    name: "Inkling",
    ownedBy: "Thinking Machines",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "minimaxai/minimax-m3",
    name: "MiniMax M3",
    ownedBy: "MiniMax AI",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "stepfun-ai/step-3.7-flash",
    name: "Step 3.7 Flash",
    ownedBy: "StepFun",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    ownedBy: "Moonshot AI",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "Nemotron Nano 12B v2 VL",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    name: "Llama 3.1 Nemotron Nano VL 8B",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "mistralai/ministral-14b-instruct-2512",
    name: "Ministral 14B Instruct 2512",
    ownedBy: "Mistral AI",
    capabilities: { vision: true },
    availability: "catalog",
  },
  {
    id: "nvidia/cosmos3-nano-reasoner",
    name: "Cosmos 3 Nano Reasoner",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "catalog",
  },
] as const;

export function mergeProviderModels(
  provider: ProviderId,
  discovered: ProviderModel[],
): ProviderModel[] {
  const catalog = new Map(
    (provider === "nvidia" ? NVIDIA_VISION_CATALOG : []).map((model) => [model.id, model]),
  );
  const merged = new Map<string, ProviderModel>();
  for (const model of discovered) {
    const catalogEntry = catalog.get(model.id);
    const availability = model.availability ?? (provider === "nvidia" ? "catalog" : undefined);
    const enriched = {
      ...catalogEntry,
      ...model,
      name: model.name === model.id && catalogEntry?.name ? catalogEntry.name : model.name,
      ...(availability ? { availability } : {}),
      capabilities: { ...catalogEntry?.capabilities, ...model.capabilities },
    };
    const inferred = inferModelMetadata(provider, enriched);
    merged.set(model.id, {
      ...enriched,
      ...inferred,
      capabilities: { ...enriched.capabilities, ...inferred.capabilities },
    });
  }
  return [...merged.values()].sort((left, right) => {
    const leftRank = modelRank(left);
    const rightRank = modelRank(right);
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}

export function inferModelMetadata(
  provider: ProviderId,
  model: ProviderModel,
): Partial<ProviderModel> {
  const id = model.id.trim();
  const inferredCapabilities: Partial<ProviderCapabilities> = {};

  if (provider === "nvidia" && NVIDIA_DEPRECATING_MODELS.has(id)) {
    return { capabilities: { vision: true }, availability: "deprecating" };
  }

  if (model.capabilities?.vision === undefined) {
    if (provider === "openai") {
      if (/^(gpt-(?:4o|4\.1|5(?:\.|-|$))|o[3-9](?:-|$))/i.test(id)) {
        inferredCapabilities.vision = true;
      }
    } else if (provider === "google") {
      inferredCapabilities.vision = /^gemini-/i.test(id);
    } else if (provider === "alibaba") {
      inferredCapabilities.vision = /(qwen(?:3[.-](?:5|6|7))|[-_/](?:vl|omni)(?:[-_/]|$))/i.test(
        id,
      );
    } else if (provider === "nvidia") {
      inferredCapabilities.vision =
        /(vision|\bvl\b|multimodal|omni|maverick|gemma-3n|minimax-m3|kimi-k2\.6|qwen3\.5|inkling|step-3\.7|cosmos3.*reasoner)/i.test(
          id,
        );
    } else if (provider === "groq") {
      inferredCapabilities.vision = /qwen\/qwen3\.6-27b|llama-4-scout/i.test(id);
    } else if (provider === "openrouter") {
      inferredCapabilities.vision =
        /^(openai\/gpt-(?:4o|4\.1|5(?:\.|-|$))|.*\/(?:.*vision|.*\bvl\b|.*omni))/i.test(id);
    } else if (provider === "cerebras") {
      inferredCapabilities.vision = /^gemma-4-31b$/i.test(id);
    }
  }

  if (model.capabilities?.structuredOutput === undefined) {
    if (provider === "openai") {
      if (/^(gpt-(?:4o|4\.1|5(?:\.|-|$))|o[3-9](?:-|$))/i.test(id)) {
        inferredCapabilities.structuredOutput = true;
      }
    } else if (provider === "google") {
      inferredCapabilities.structuredOutput = /^gemini-/i.test(id);
    } else if (provider === "groq") {
      inferredCapabilities.structuredOutput =
        /(?:openai\/)?gpt-oss-(?:20b|120b)|llama-4-scout/i.test(id);
    } else if (provider === "openrouter") {
      inferredCapabilities.structuredOutput =
        /^openai\/(?:gpt-(?:4o|4\.1|5(?:\.|-|$))|o[3-9](?:-|$))/i.test(id);
    } else if (provider === "cerebras") {
      inferredCapabilities.structuredOutput = /gpt-oss|llama/i.test(id);
    } else if (provider === "alibaba" || provider === "nvidia") {
      inferredCapabilities.structuredOutput = false;
    }
  }

  return { capabilities: inferredCapabilities };
}

export function effectiveModelCapabilities(
  provider: ProviderId,
  settings: AppSettings,
  modelId: string,
  discovered?: ProviderModel,
): ProviderCapabilities {
  const inferred = inferModelMetadata(provider, discovered ?? { id: modelId, name: modelId });
  return {
    ...PROVIDER_DEFINITIONS[provider].capabilities,
    ...inferred.capabilities,
    ...discovered?.capabilities,
    ...settings.providerCapabilityOverrides[provider],
  };
}

export function isLessonPlanningModel(model: ProviderModel): boolean {
  return !/(^|[-_/])(embed|embedding|rerank|whisper|transcri|speech|tts|guard|moderation|safety|reward|classifier|detector|dall-e|gpt-image|stable-diffusion|flux|realtime|live|native-audio|imagen|veo|image-generation)([-_/]|$)/i.test(
    model.id,
  );
}

function modelRank(model: ProviderModel): number {
  if (model.availability === "deprecating") return 3;
  if (model.capabilities?.vision) return 0;
  return 2;
}
