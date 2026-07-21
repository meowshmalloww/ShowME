import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compatibleOutputMode,
  extractCompatibleResponse,
  extractCompatibleText,
  extractOpenAiResponse,
  normalizeModelLessonDraft,
  ProviderService,
  supportsNvidiaThinkingMode,
  supportsReasoningControl,
} from "../src/main/providers";
import type { SecretStore } from "../src/main/secrets";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { mergeProviderModels, NVIDIA_VISION_CATALOG } from "../src/shared/model-catalog";
import {
  effectiveCapabilities,
  normalizeQwenCloudBaseUrl,
  providerEndpoints,
  providerSummaries,
} from "../src/shared/providers";
import { validateLessonPlan } from "../src/shared/schema";
import type { ProviderCapabilities } from "../src/shared/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const compatiblePlan = {
  version: 1,
  title: "Read the selected layout",
  concept: "Visual grouping",
  summary: "The layout groups related controls.",
  teachingMode: "diagram-annotation",
  confidence: "exploratory",
  sourceDescription: "The selected app region",
  narration: "Start with the visible groups.",
  primitives: [{ id: "focus", kind: "rect", x: 100, y: 100, width: 500, height: 300 }],
  steps: [
    {
      id: "step-1",
      title: "Find the group",
      narration: "Look at the outlined region.",
      primitiveIds: ["focus"],
      durationMs: 900,
    },
  ],
  controls: [],
  claims: [
    {
      id: "claim-1",
      text: "The outlined controls are visibly grouped.",
      evidence: "selected-source",
      citationIds: [],
    },
  ],
  citations: [],
  followUps: ["Which control should we inspect next?"],
};

const allCapabilities: ProviderCapabilities = {
  vision: true,
  structuredOutput: true,
  webSearch: false,
  speechToText: false,
  textToSpeech: false,
  streaming: true,
  tools: true,
};

describe("provider capability overrides", () => {
  it("keeps provider defaults visible while applying a model-specific override", () => {
    const settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      providerCapabilityOverrides: { cerebras: { vision: true } },
    };
    expect(effectiveCapabilities("cerebras", settings).vision).toBe(true);
    const cerebras = providerSummaries(settings, {}).find((item) => item.id === "cerebras");
    expect(cerebras?.defaultCapabilities.vision).toBe(false);
    expect(cerebras?.capabilities.vision).toBe(true);
  });
});

describe("Qwen Cloud API hosts", () => {
  it("uses the current Qwen Cloud international endpoint by default", () => {
    expect(providerEndpoints("alibaba", DEFAULT_SETTINGS)).toEqual({
      baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      modelsUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    });
  });

  it("routes Token Plan and Coding Plan keys through their paired API Host", () => {
    expect(
      providerEndpoints("alibaba", {
        qwenBaseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      }).baseUrl,
    ).toContain("token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
    expect(
      providerEndpoints("alibaba", {
        qwenBaseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1",
      }).modelsUrl,
    ).toBe("https://coding-intl.dashscope.aliyuncs.com/v1/models");
  });

  it("normalizes copied endpoint paths and rejects unrelated hosts", () => {
    expect(
      normalizeQwenCloudBaseUrl(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions/",
      ),
    ).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
    expect(() => normalizeQwenCloudBaseUrl("https://example.com/v1")).toThrow(
      /Qwen Cloud API Host/,
    );
  });
});

describe("provider response contracts", () => {
  it("extracts Responses API output text and verified citation annotations", () => {
    const response = extractOpenAiResponse({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: '{"version":1}',
              annotations: [
                { type: "url_citation", url: "https://example.com/source", title: "Source" },
              ],
            },
          ],
        },
      ],
    });
    expect(response.text).toBe('{"version":1}');
    expect(response.citations).toEqual([{ url: "https://example.com/source", title: "Source" }]);
  });

  it("accepts text-part arrays from OpenAI-compatible providers", () => {
    expect(
      extractCompatibleText({
        choices: [{ message: { content: [{ type: "text", text: "connected" }] } }],
      }),
    ).toBe("connected");
    expect(
      extractCompatibleResponse({
        choices: [{ finish_reason: "length", message: { content: "partial" } }],
      }),
    ).toMatchObject({ text: "partial", finishReason: "length" });
  });

  it("only sends reasoning controls to matching model families", () => {
    expect(supportsReasoningControl("gpt-5.6-sol")).toBe(true);
    expect(supportsReasoningControl("o3-mini")).toBe(true);
    expect(supportsReasoningControl("gpt-4.1-mini")).toBe(false);
    expect(supportsNvidiaThinkingMode("nvidia/nemotron-nano-12b-v2-vl")).toBe(true);
    expect(supportsNvidiaThinkingMode("meta/llama-4-maverick-17b-128e-instruct")).toBe(false);
  });

  it("removes untrusted model keys and dangling visual references before validation", () => {
    const normalized = normalizeModelLessonDraft({
      version: 1,
      title: "A grounded lesson",
      concept: "Visible structure",
      summary: "Read the selected region.",
      teachingMode: "diagram-annotation",
      confidence: "exploratory",
      sourceDescription: "Selection",
      narration: "Start with what is visible.",
      executableHtml: "<script>bad()</script>",
      primitives: [{ id: "focus", kind: "rect", x: 1, y: 2, unsafe: true }],
      steps: [
        {
          id: "step-1",
          title: "Look",
          narration: "Find the focus.",
          primitiveIds: ["focus", "missing"],
          durationMs: 900,
          html: "<b>bad</b>",
        },
      ],
      controls: [{ id: "fake", label: "Fake", bind: "x", min: 0, max: 1, step: 1, value: 0 }],
      claims: [
        {
          id: "claim-1",
          text: "The selection contains the focus.",
          evidence: "selected-source",
          citationIds: ["invented"],
        },
      ],
      citations: [{ id: "invented", url: "https://example.com" }],
      followUps: [],
    });
    expect(normalized.executableHtml).toBeUndefined();
    expect(normalized.primitives).toEqual([{ id: "focus", kind: "rect", x: 1, y: 2 }]);
    expect((normalized.steps as Array<{ primitiveIds: string[] }>)[0]?.primitiveIds).toEqual([
      "focus",
    ]);
    expect(normalized.controls).toEqual([]);
    expect(normalized.citations).toEqual([]);
    expect((normalized.claims as Array<{ citationIds: string[] }>)[0]?.citationIds).toEqual([]);
  });

  it("repairs bounded model shape mistakes without weakening final validation", () => {
    const normalized = normalizeModelLessonDraft({
      version: "1",
      title: "A".repeat(180),
      narration: "Read the selected relationship.",
      teachingMode: "visual",
      confidence: "verified-module",
      primitives: [
        {
          id: "focus",
          kind: "rectangle",
          x: "-20",
          y: "1200",
          width: "450",
          height: "220",
        },
        { id: "focus", kind: "label", x: "100", y: "200", text: "Look here" },
        { id: "broken", kind: "rect", x: "not-a-number", y: 20 },
      ],
      steps: [
        {
          id: "focus",
          narration: "Start with the highlighted area.",
          primitiveIds: ["focus", "missing"],
          durationMs: "99999",
        },
      ],
      claims: [{ id: "focus", text: "This is visible.", evidence: "screen" }],
    });
    const plan = validateLessonPlan({
      ...normalized,
      id: "lesson-1",
      provider: { id: "nvidia", model: "nvidia/nemotron-nano-12b-v2-vl" },
    });
    expect(plan.title).toHaveLength(120);
    expect(plan.primitives).toHaveLength(2);
    expect(plan.primitives[0]).toMatchObject({ id: "focus", kind: "rect", x: 0, y: 1000 });
    expect(plan.primitives[1]?.id).not.toBe("focus");
    expect(plan.steps[0]).toMatchObject({ durationMs: 30_000, primitiveIds: ["focus"] });
    expect(
      new Set([
        ...plan.primitives.map((item) => item.id),
        ...plan.steps.map((item) => item.id),
        ...plan.claims.map((item) => item.id),
      ]).size,
    ).toBe(4);
    expect(plan.controls).toEqual([]);
    expect(plan.followUps).toEqual([]);
    expect(plan.confidence).toBe("exploratory");
  });

  it("uses NVIDIA's documented prompt contract with reasoning disabled for the selected VLM", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            { finish_reason: "stop", message: { content: JSON.stringify(compatiblePlan) } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const secrets = { get: () => "nvapi-test-credential" } as unknown as SecretStore;
    const service = new ProviderService(secrets);
    const settings = {
      ...structuredClone(DEFAULT_SETTINGS),
      provider: "nvidia" as const,
    };
    const plan = await service.generate({
      request: {
        captureId: "capture-1",
        question: "What does this layout show?",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "nvidia",
        model: "nvidia/nemotron-nano-12b-v2-vl",
      },
      context: {
        captureId: "capture-1",
        previewDataUrl: "data:image/png;base64,AA==",
        regions: [],
        pixelWidth: 800,
        pixelHeight: 600,
        capturePixelWidth: 800,
        capturePixelHeight: 600,
        display: {
          id: 1,
          label: "Test display",
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          workArea: { x: 0, y: 0, width: 800, height: 560 },
          size: { width: 800, height: 600 },
          scaleFactor: 1,
        },
        cropBounds: { x: 0, y: 0, width: 800, height: 600 },
        containsAnnotations: false,
        scope: "display",
      },
      settings,
      memoryContext: "",
      signal: new AbortController().signal,
    });
    expect(plan.title).toBe(compatiblePlan.title);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
      response_format?: unknown;
    };
    expect(request.messages[0]?.content.startsWith("/no_think")).toBe(true);
    expect(request.response_format).toBeUndefined();
    expect(request.messages[0]?.content).toContain('{"version":1');
  });

  it("feeds exact validation paths and truncation reason into one bounded correction", async () => {
    const repaired = {
      lesson: {
        title: "Read the selected layout",
        narration: "The visible controls form one related group.",
        primitives: [
          {
            id: "focus",
            kind: "rectangle",
            x: "100",
            y: "100",
            width: "500",
            height: "300",
          },
        ],
        steps: [
          {
            narration: "Look at the grouped controls.",
            primitiveIds: ["focus"],
            durationMs: "900",
          },
        ],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "length", message: { content: '{"version":1}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content: JSON.stringify(repaired) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "nvapi-test-credential",
    } as unknown as SecretStore);
    const settings = { ...structuredClone(DEFAULT_SETTINGS), provider: "nvidia" as const };
    const plan = await service.generate({
      request: {
        captureId: "capture-1",
        question: "What does this layout show?",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "nvidia",
        model: "nvidia/nemotron-nano-12b-v2-vl",
      },
      context: {
        captureId: "capture-1",
        previewDataUrl: "data:image/png;base64,AA==",
        regions: [],
        pixelWidth: 800,
        pixelHeight: 600,
        capturePixelWidth: 800,
        capturePixelHeight: 600,
        display: {
          id: 1,
          label: "Test display",
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          workArea: { x: 0, y: 0, width: 800, height: 560 },
          size: { width: 800, height: 600 },
          scaleFactor: 1,
        },
        cropBounds: { x: 0, y: 0, width: 800, height: 600 },
        containsAnnotations: false,
        scope: "display",
      },
      settings,
      memoryContext: "",
      signal: new AbortController().signal,
    });
    expect(plan.title).toBe("Read the selected layout");
    expect(plan.steps[0]?.durationMs).toBe(900);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const correction = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(correction.messages[1]?.content).toContain("Provider finish reason: length");
    expect(correction.messages[1]?.content).toContain("$.title");
    expect(correction.messages[1]?.content).toContain("no more than 3 steps and 8 primitives");
  });

  it("keeps the calibrated screenshot attached when repairing invisible geometry", async () => {
    const brokenVisualPlan = {
      ...compatiblePlan,
      primitives: [{ id: "invisible", kind: "path", x: 100, y: 100 }],
      steps: [{ ...compatiblePlan.steps[0], primitiveIds: ["invisible"] }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(brokenVisualPlan) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(compatiblePlan) } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "nvapi-test-credential",
    } as unknown as SecretStore);
    const settings = { ...structuredClone(DEFAULT_SETTINGS), provider: "nvidia" as const };

    await service.generate({
      request: {
        captureId: "capture-visual-repair",
        question: "Point to the angle.",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "nvidia",
        model: "nvidia/nemotron-nano-12b-v2-vl",
      },
      context: {
        captureId: "capture-visual-repair",
        previewDataUrl: "data:image/png;base64,CLEAN",
        analysisDataUrl: "data:image/png;base64,CALIBRATED",
        regions: [],
        pixelWidth: 800,
        pixelHeight: 600,
        capturePixelWidth: 800,
        capturePixelHeight: 600,
        display: {
          id: 1,
          label: "Test display",
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          workArea: { x: 0, y: 0, width: 800, height: 560 },
          size: { width: 800, height: 600 },
          scaleFactor: 1,
        },
        cropBounds: { x: 0, y: 0, width: 800, height: 600 },
        containsAnnotations: false,
        scope: "display",
      },
      settings,
      memoryContext: "",
      signal: new AbortController().signal,
    });

    const correction = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      model: string;
      messages: Array<{ content: unknown }>;
    };
    expect(correction.model).toBe("nvidia/nemotron-nano-12b-v2-vl");
    expect(correction.messages[1]?.content).toEqual(
      expect.arrayContaining([
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,CALIBRATED" },
        },
      ]),
    );
  });

  it("uses each provider's supported structured-output contract", async () => {
    const cases = [
      {
        provider: "groq",
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        expectedType: "json_schema",
        copiedText: undefined,
      },
      {
        provider: "alibaba",
        model: "qwen3.7-plus",
        expectedType: "json_object",
        copiedText: undefined,
      },
      {
        provider: "cerebras",
        model: "gpt-oss-120b",
        expectedType: "json_object",
        copiedText: "A visible group of related controls.",
      },
    ] as const;

    for (const testCase of cases) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(compatiblePlan) } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const service = new ProviderService({
        get: () => "test-credential",
      } as unknown as SecretStore);
      const settings = structuredClone(DEFAULT_SETTINGS);
      settings.provider = testCase.provider;
      settings.models[testCase.provider] = testCase.model;
      await service.generate({
        request: {
          captureId: "capture-1",
          question: "What does this show?",
          ...(testCase.copiedText ? { copiedText: testCase.copiedText } : {}),
          includeNearbyContext: false,
          includeActiveWindow: false,
          researchMode: "quick",
          allowWebResearch: false,
          allowImageAids: false,
          language: "en",
          teachingStyle: "visual-fast",
          complexity: "standard",
          provider: testCase.provider,
          model: testCase.model,
        },
        context: {
          captureId: "capture-1",
          previewDataUrl: "data:image/png;base64,AA==",
          regions: [],
          pixelWidth: 800,
          pixelHeight: 600,
          capturePixelWidth: 800,
          capturePixelHeight: 600,
          display: {
            id: 1,
            label: "Test display",
            bounds: { x: 0, y: 0, width: 800, height: 600 },
            workArea: { x: 0, y: 0, width: 800, height: 560 },
            size: { width: 800, height: 600 },
            scaleFactor: 1,
          },
          cropBounds: { x: 0, y: 0, width: 800, height: 600 },
          containsAnnotations: false,
          scope: "display",
        },
        settings,
        memoryContext: "",
        signal: new AbortController().signal,
      });

      const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, any>;
      expect(request.response_format.type).toBe(testCase.expectedType);
      if (testCase.provider === "groq") {
        expect(request.response_format.json_schema.strict).toBe(false);
      }
      if (testCase.provider === "alibaba") {
        expect(request).not.toHaveProperty("max_tokens");
      }
      if (testCase.provider === "cerebras") {
        expect(request.max_completion_tokens).toBe(16_000);
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
          "X-Cerebras-Version-Patch": "2",
        });
      }
    }
  });

  it("selects strict Groq output only for its supported GPT-OSS models", () => {
    expect(compatibleOutputMode("groq", "openai/gpt-oss-120b", allCapabilities)).toBe(
      "strict-schema",
    );
    expect(
      compatibleOutputMode("groq", "meta-llama/llama-4-scout-17b-16e-instruct", allCapabilities),
    ).toBe("best-effort-schema");
  });
});

describe("provider model catalogs", () => {
  it("enriches only NVIDIA models actually returned by the catalog without calling them free", () => {
    const models = mergeProviderModels("nvidia", [
      {
        id: "meta/llama-4-maverick-17b-128e-instruct",
        name: "meta/llama-4-maverick-17b-128e-instruct",
      },
    ]);
    expect(NVIDIA_VISION_CATALOG.length).toBeGreaterThan(1);
    expect(models.some((model) => model.id === "nvidia/nemotron-nano-12b-v2-vl")).toBe(false);
    expect(
      models.find((model) => model.id === "meta/llama-4-maverick-17b-128e-instruct")?.availability,
    ).toBe("deprecating");
    expect(models).toHaveLength(1);
  });

  it("keeps OpenRouter's published image and structured-output metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "vendor/vision-model",
              name: "Vision model",
              architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
              supported_parameters: ["structured_outputs", "tools"],
            },
            { id: "vendor/text-embedding", name: "Embedding" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "openrouter-test-key",
    } as unknown as SecretStore);
    const models = await service.listModels("openrouter");
    expect(models).toHaveLength(1);
    expect(models[0]?.capabilities).toMatchObject({
      vision: true,
      structuredOutput: true,
      tools: true,
    });
  });
});

describe("speech provider routes", () => {
  it("sends recorded audio directly to Deepgram Nova-3", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: { channels: [{ alternatives: [{ transcript: "Explain this graph." }] }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "deepgram-test-key",
    } as unknown as SecretStore);

    await expect(
      service.transcribe("deepgram", new Uint8Array([1, 2, 3]), "audio/webm", "en"),
    ).resolves.toBe("Explain this graph.");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("api.deepgram.com/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(init.headers).toMatchObject({
      Authorization: "Token deepgram-test-key",
      "Content-Type": "audio/webm",
    });
  });

  it("uses ElevenLabs Scribe v2 for transcription", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "Show me the highlighted control." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "elevenlabs-test-key",
    } as unknown as SecretStore);

    await expect(
      service.transcribe("elevenlabs", new Uint8Array([1, 2]), "audio/webm", "en"),
    ).resolves.toBe("Show me the highlighted control.");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(init.headers).toMatchObject({ "xi-api-key": "elevenlabs-test-key" });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("model_id")).toBe("scribe_v2");
  });

  it("uses ElevenLabs Flash for narrated lesson audio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "elevenlabs-test-key",
    } as unknown as SecretStore);

    const audio = await service.synthesize(
      "elevenlabs",
      "Start with the visible pattern.",
      "marin",
      "JBFqnCBsd6RMkjVDRZzb",
      1.1,
    );
    expect(audio.mimeType).toBe("audio/mpeg");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model_id: "eleven_flash_v2_5",
      voice_settings: { speed: 1.1 },
    });
  });

  it("uses Deepgram Aura narration without any OpenAI audio route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([7, 8, 9]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "deepgram-test-key",
    } as unknown as SecretStore);

    const audio = await service.synthesize(
      "deepgram",
      "Now compare the two highlighted angles.",
      "aura-2-orion-en",
      "unused-elevenlabs-voice",
      1.8,
    );
    expect(audio.mimeType).toBe("audio/mpeg");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api.deepgram.com/v1/speak");
    expect(url.searchParams.get("model")).toBe("aura-2-orion-en");
    expect(url.searchParams.get("speed")).toBe("1.5");
    expect(init.headers).toMatchObject({
      Authorization: "Token deepgram-test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      text: "Now compare the two highlighted angles.",
    });
  });

  it("validates a saved Deepgram key through its no-audio auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ api_key_id: "key-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "deepgram-test-key",
    } as unknown as SecretStore);

    await expect(service.testSpeechService("deepgram")).resolves.toContain("Deepgram key verified");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepgram.com/v1/auth/token",
      expect.objectContaining({ headers: { Authorization: "Token deepgram-test-key" } }),
    );
  });

  it("validates ElevenLabs without generating billable narration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ model_id: "scribe_v2" }, { model_id: "eleven_flash_v2_5" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "elevenlabs-test-key",
    } as unknown as SecretStore);

    await expect(service.testSpeechService("elevenlabs")).resolves.toContain(
      "ElevenLabs key verified",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/models",
      expect.objectContaining({ headers: { "xi-api-key": "elevenlabs-test-key" } }),
    );
  });
});

describe("NVIDIA hosted access errors", () => {
  it("explains the Public API Endpoints entitlement when NVIDIA returns authorization failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: 403, title: "Forbidden", detail: "Authorization failed" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );
    const service = new ProviderService({
      get: () => "nvapi-test-key",
    } as unknown as SecretStore);

    await expect(
      service.test("nvidia", "nvidia/nemotron-nano-12b-v2-vl", DEFAULT_SETTINGS),
    ).rejects.toMatchObject({
      code: "PROVIDER_ACCESS_DENIED",
      remediation: expect.stringContaining("Public API Endpoints"),
    });
  });
});
