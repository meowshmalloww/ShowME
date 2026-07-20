import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCompatibleText,
  extractOpenAiResponse,
  normalizeModelLessonDraft,
  ProviderService,
  supportsNvidiaThinkingMode,
  supportsReasoningControl,
} from "../src/main/providers";
import type { SecretStore } from "../src/main/secrets";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { mergeProviderModels, NVIDIA_FREE_VISION_MODELS } from "../src/shared/model-catalog";
import { effectiveCapabilities, providerSummaries } from "../src/shared/providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("uses NVIDIA's JSON-schema route with reasoning disabled for the selected VLM", async () => {
    const responsePlan = {
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "guided decoding backend failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              { finish_reason: "stop", message: { content: JSON.stringify(responsePlan) } },
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
    expect(plan.title).toBe(responsePlan.title);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
      response_format: { type: string; json_schema: { schema: unknown } };
    };
    expect(request.messages[0]?.content.startsWith("/no_think")).toBe(true);
    expect(request.response_format.type).toBe("json_schema");
    expect(request.response_format.json_schema.schema).toBeTruthy();
    const fallbackRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
      response_format?: unknown;
    };
    expect(fallbackRequest.response_format).toBeUndefined();
    expect(fallbackRequest.messages[0]?.content).toContain('{"version":1');
  });
});

describe("provider model catalogs", () => {
  it("merges NVIDIA's discovered models with multiple verified free VLM choices", () => {
    const models = mergeProviderModels("nvidia", [
      {
        id: "meta/llama-4-maverick-17b-128e-instruct",
        name: "meta/llama-4-maverick-17b-128e-instruct",
      },
    ]);
    expect(NVIDIA_FREE_VISION_MODELS.length).toBeGreaterThan(1);
    expect(models.some((model) => model.id === "nvidia/nemotron-nano-12b-v2-vl")).toBe(true);
    expect(
      models.find((model) => model.id === "meta/llama-4-maverick-17b-128e-instruct")?.availability,
    ).toBe("deprecating");
    expect(models.filter((model) => model.capabilities?.vision).length).toBeGreaterThan(1);
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
});
