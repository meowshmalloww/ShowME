import type { ProviderId, ProviderModel } from "./types";

const NVIDIA_DEPRECATING_MODELS = new Set([
  "meta/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3.5-122b-a10b",
  "qwen/qwen3.5-397b-a17b",
  "mistralai/mistral-small-4-119b-2603",
]);

export const NVIDIA_FREE_VISION_MODELS: readonly ProviderModel[] = [
  {
    id: "thinkingmachines/inkling",
    name: "Inkling",
    ownedBy: "Thinking Machines",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "minimaxai/minimax-m3",
    name: "MiniMax M3",
    ownedBy: "MiniMax AI",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "stepfun-ai/step-3.7-flash",
    name: "Step 3.7 Flash",
    ownedBy: "StepFun",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    ownedBy: "Moonshot AI",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "Nemotron Nano 12B v2 VL",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    name: "Llama 3.1 Nemotron Nano VL 8B",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "mistralai/ministral-14b-instruct-2512",
    name: "Ministral 14B Instruct 2512",
    ownedBy: "Mistral AI",
    capabilities: { vision: true },
    availability: "free",
  },
  {
    id: "nvidia/cosmos3-nano-reasoner",
    name: "Cosmos 3 Nano Reasoner",
    ownedBy: "NVIDIA",
    capabilities: { vision: true },
    availability: "free",
  },
] as const;

export function mergeProviderModels(
  provider: ProviderId,
  discovered: ProviderModel[],
): ProviderModel[] {
  const catalog = provider === "nvidia" ? NVIDIA_FREE_VISION_MODELS : [];
  const merged = new Map<string, ProviderModel>();
  for (const model of [...catalog, ...discovered]) {
    const existing = merged.get(model.id);
    const inferred = inferModelMetadata(provider, model);
    merged.set(model.id, {
      ...existing,
      ...model,
      name: model.name === model.id && existing?.name ? existing.name : model.name,
      ...inferred,
      capabilities: { ...existing?.capabilities, ...model.capabilities, ...inferred.capabilities },
    });
  }
  return [...merged.values()].sort((left, right) => {
    const leftRank = modelRank(left);
    const rightRank = modelRank(right);
    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}

function inferModelMetadata(provider: ProviderId, model: ProviderModel): Partial<ProviderModel> {
  if (provider !== "nvidia") return {};
  if (NVIDIA_DEPRECATING_MODELS.has(model.id)) {
    return { capabilities: { vision: true }, availability: "deprecating" };
  }
  if (model.capabilities?.vision !== undefined) return {};
  const vision =
    /(vision|\bvl\b|multimodal|omni|maverick|gemma-3n|minimax-m3|kimi-k2\.6|qwen3\.5|inkling|step-3\.7|cosmos3.*reasoner)/i.test(
      model.id,
    );
  return vision ? { capabilities: { vision: true } } : {};
}

function modelRank(model: ProviderModel): number {
  if (model.availability === "deprecating") return 3;
  if (model.capabilities?.vision) return model.availability === "free" ? 0 : 1;
  return 2;
}
