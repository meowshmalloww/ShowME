import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compatibleOutputMode,
  createGroundedFallbackPlan,
  extractCompatibleResponse,
  extractCompatibleText,
  extractGeminiResponse,
  extractOpenAiResponse,
  formatValidationFeedback,
  motionSceneRequestHint,
  normalizeModelLessonDraft,
  openAiReasoningEffort,
  ProviderService,
  requestedSimulationKind,
  simulationRequestHint,
  supportsNvidiaThinkingMode,
  supportsQwenHybridThinking,
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

  it("recognizes the current Groq and Cerebras screenshot models", () => {
    const groq = mergeProviderModels("groq", [
      { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B" },
      { id: "openai/gpt-oss-120b", name: "GPT OSS 120B" },
    ]);
    const cerebras = mergeProviderModels("cerebras", [
      { id: "gemma-4-31b", name: "Gemma 4 31B" },
      { id: "gpt-oss-120b", name: "GPT OSS 120B" },
    ]);

    expect(groq.find((model) => model.id === "qwen/qwen3.6-27b")?.capabilities?.vision).toBe(true);
    expect(groq.find((model) => model.id === "openai/gpt-oss-120b")?.capabilities?.vision).toBe(
      false,
    );
    expect(cerebras.find((model) => model.id === "gemma-4-31b")?.capabilities?.vision).toBe(true);
    expect(cerebras.find((model) => model.id === "gpt-oss-120b")?.capabilities?.vision).toBe(false);
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

  it("extracts Gemini candidate text without exposing thought parts", () => {
    expect(
      extractGeminiResponse({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ thought: true, text: "private reasoning" }, { text: '{"version":1}' }],
            },
          },
        ],
      }),
    ).toMatchObject({ text: '{"version":1}', finishReason: "STOP", citations: [] });
  });

  it("only sends reasoning controls to matching model families", () => {
    expect(supportsReasoningControl("gpt-5.6-sol")).toBe(true);
    expect(supportsReasoningControl("o3-mini")).toBe(true);
    expect(supportsReasoningControl("gpt-4.1-mini")).toBe(false);
    expect(openAiReasoningEffort("gpt-5.4-mini", false)).toBe("none");
    expect(openAiReasoningEffort("gpt-5.6-sol", false)).toBe("minimal");
    expect(openAiReasoningEffort("gpt-5.4-mini", true)).toBe("high");
    expect(supportsNvidiaThinkingMode("nvidia/nemotron-nano-12b-v2-vl")).toBe(true);
    expect(supportsNvidiaThinkingMode("meta/llama-4-maverick-17b-128e-instruct")).toBe(false);
    expect(supportsQwenHybridThinking("qwen3.7-plus")).toBe(true);
    expect(supportsQwenHybridThinking("qwen3.7-max-preview")).toBe(false);
  });

  it("requires a trusted simulation when the learner explicitly asks for one", () => {
    expect(
      requestedSimulationKind(
        "Animate the Promise microtask and setTimeout with an interactive event loop simulation.",
      ),
    ).toBe("event-loop");
    expect(
      simulationRequestHint(
        "Show an interactive projectile simulation with launch angle controls.",
      ),
    ).toContain('simulation={"kind":"projectile"');
    expect(requestedSimulationKind("Draw an arrow along this trajectory.")).toBeUndefined();
    expect(
      motionSceneRequestHint("Use motion graphics to explain this history timeline."),
    ).toContain('"kind":"motion-scene"');
    expect(motionSceneRequestHint("Circle the date on this page.")).toBe("");
  });

  it("preserves a valid generated lesson when generic motion art omits its custom module", async () => {
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
    const service = new ProviderService({ get: () => "nvapi-test" } as unknown as SecretStore);
    const settings = { ...structuredClone(DEFAULT_SETTINGS), provider: "nvidia" as const };
    const plan = await service.generate({
      request: {
        captureId: "capture-motion",
        question: "Show an interactive motion-art simulation of this causal chain.",
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
        captureId: "capture-motion",
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(plan.teachingMode).toBe("interactive-experiment");
    expect(plan.simulation?.kind).toBe("custom");
    if (plan.simulation?.kind !== "custom") throw new Error("Expected a custom simulation");
    expect(plan.simulation.entities).toHaveLength(1);
    expect(plan.simulation.motions).toHaveLength(1);
  });

  it("keeps the actual validation error beside the provider finish reason", () => {
    expect(formatValidationFeedback(new Error("Custom simulation was omitted"), "stop")).toContain(
      "Custom simulation was omitted",
    );
  });

  it("returns an honest grounded lesson after two truncated OpenAI responses", async () => {
    const truncated = {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"version":1,"title":"Partial"' }],
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(truncated), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(truncated), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({ get: () => "sk-test" } as unknown as SecretStore);
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.models.openai = "gpt-5.4-mini";
    settings.textModels.openai = "gpt-5.4-mini";
    const request = {
      captureId: "capture-truncated",
      question: "Show me this selected relationship.",
      includeNearbyContext: false,
      includeActiveWindow: false,
      researchMode: "quick" as const,
      allowWebResearch: false,
      allowImageAids: false,
      language: "en",
      teachingStyle: "visual-fast" as const,
      complexity: "standard" as const,
      provider: "openai" as const,
      model: "gpt-5.4-mini",
    };
    const context = {
      captureId: "capture-truncated",
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
      scope: "display" as const,
    };

    const plan = await service.generate({
      request,
      context,
      settings,
      memoryContext: "",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan.title).toContain("Visual lesson interrupted");
    expect(plan.uncertainty).toContain("max_output_tokens");
    expect(plan.primitives.map((primitive) => primitive.kind)).toEqual(["point", "callout"]);
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(firstRequest).toMatchObject({
      max_output_tokens: 24_000,
      reasoning: { effort: "none" },
      text: { verbosity: "low" },
    });
  });

  it("keeps a Qwen lesson usable after two incomplete streamed JSON responses", async () => {
    const event = {
      choices: [
        {
          finish_reason: "length",
          delta: { content: '{"version":1,"title":"Partial"' },
        },
      ],
    };
    const stream = `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({ get: () => "qwen-test-key" } as unknown as SecretStore);
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.provider = "alibaba";
    settings.models.alibaba = "qwen3.5-plus";
    settings.textModels.alibaba = "qwen3.5-plus";

    const plan = await service.generate({
      request: {
        captureId: "capture-qwen-truncated",
        question: "Show me this visible relationship.",
        copiedText: "A visible relationship selected by the learner.",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "alibaba",
        model: "qwen3.5-plus",
      },
      context: {
        captureId: "capture-qwen-truncated",
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan.title).toContain("Visual lesson interrupted");
    expect(plan.uncertainty).toContain("length");
    for (const call of fetchMock.mock.calls) {
      const request = JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
      expect(request.max_tokens).toBeUndefined();
      expect(request.enable_thinking).toBe(false);
    }
  });

  it("builds a validated local fallback that keeps requested simulations usable", () => {
    const plan = createGroundedFallbackPlan(
      {
        captureId: "capture-fallback",
        question: "Show an interactive projectile simulation.",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "openai",
        model: "gpt-5.4-mini",
      },
      {
        captureId: "capture-fallback",
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
    );

    expect(plan.simulation?.kind).toBe("projectile");
    expect(validateLessonPlan(plan).steps).toHaveLength(1);
    expect(plan.primitives.some((primitive) => primitive.kind === "highlight")).toBe(false);
    const fallbackNote = plan.primitives.find((primitive) => primitive.id === "fallback-note");
    expect(fallbackNote?.text).toBe("The visual answer did not finish safely");
  });

  it("disables hybrid Qwen thinking for a fast connection check", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "connected" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "qwen-test-key",
    } as unknown as SecretStore);

    await expect(service.test("alibaba", "qwen3.7-plus", DEFAULT_SETTINGS)).resolves.toContain(
      "Connected to Qwen Cloud",
    );
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(request).toMatchObject({ model: "qwen3.7-plus", enable_thinking: false, stream: false });
    expect(request).toMatchObject({
      messages: [
        {
          role: "user",
          content: [
            { type: "text" },
            { type: "image_url", image_url: { url: expect.stringMatching(/^data:image\/png/) } },
          ],
        },
      ],
    });
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

  it("normalizes provider-generated diagnosis, Try, Transfer, and point targets", () => {
    const normalized = normalizeModelLessonDraft({
      version: 1,
      title: "Find theta",
      concept: "Angle relationships",
      summary: "Use the visible triangle.",
      teachingMode: "diagram-annotation",
      confidence: "exploratory",
      sourceDescription: "Selected triangle",
      narration: "Start with the marked angle.",
      primitives: [
        { id: "theta", kind: "circle", x: 400, y: 200, radius: 50 },
        { id: "side", kind: "arrow", x: 700, y: 200, x2: 450, y2: 250 },
      ],
      steps: [
        {
          id: "locate",
          title: "Locate",
          narration: "Find theta.",
          primitiveIds: ["theta"],
          durationMs: 900,
        },
        {
          id: "trace",
          title: "Trace",
          narration: "Trace the side.",
          primitiveIds: ["side"],
          durationMs: 900,
        },
      ],
      diagnosticProbe: {
        prompt: "Which part is unclear?",
        choices: [
          { label: "Finding theta", focusStepId: "locate" },
          { label: "Choosing the side", focusStepId: "trace" },
          { label: "Invalid option", focusStepId: "missing" },
        ],
      },
      learningCheck: {
        kind: "multiple-choice",
        prompt: "Which side touches theta?",
        choices: ["Adjacent", "Opposite"],
        answer: "adjacent",
        explanation: "The adjacent side touches theta.",
      },
      transferCheck: {
        kind: "point",
        prompt: "Point to theta in the new diagram.",
        target: { x: 380, y: 180, width: 140, height: 120 },
        voiceAnswers: ["theta", "theta"],
        explanation: "The marked corner is theta.",
      },
      controls: [],
      claims: [],
      citations: [],
      followUps: [],
    });
    expect(normalized.diagnosticProbe).toMatchObject({
      choices: [{ focusStepId: "locate" }, { focusStepId: "trace" }],
    });
    expect(normalized.learningCheck).toMatchObject({ answer: "Adjacent" });
    expect(normalized.transferCheck).toMatchObject({
      kind: "point",
      voiceAnswers: ["theta"],
    });
  });

  it("keeps a complete visual lesson when Qwen collapses all drawable marks into one step", () => {
    const normalized = normalizeModelLessonDraft({
      version: 1,
      title: "Find the selected angle",
      concept: "Opposite and adjacent sides",
      summary: "Mark the angle, trace the sides, then apply tangent.",
      teachingMode: "worked-derivation",
      confidence: "exploratory",
      sourceDescription: "A selected triangle problem",
      narration: "Follow the marked angle and its two sides.",
      primitives: [
        { id: "theta-focus", kind: "circle", x: 720, y: 240, radius: 44 },
        { id: "side-arrow", kind: "arrow", x: 850, y: 180, x2: 610, y2: 520 },
        { id: "formula", kind: "equation", x: 70, y: 80, text: "tan(theta) = 11.9 / 10" },
      ],
      steps: [
        {
          id: "locate",
          title: "Locate theta",
          narration: "First, find the selected angle and the two sides around it.",
          primitiveIds: ["theta-focus", "side-arrow"],
          durationMs: 1_200,
        },
        {
          id: "relate",
          title: "Relate the sides",
          narration: "The arrow traces the opposite and adjacent sides.",
          primitiveIds: [],
          durationMs: 1_400,
        },
        {
          id: "calculate",
          title: "Apply tangent",
          narration: "Now divide opposite by adjacent.",
          primitiveIds: ["formula"],
          durationMs: 1_500,
        },
      ],
      controls: [],
      claims: [],
      citations: [],
      followUps: [],
    });
    const plan = validateLessonPlan({
      ...normalized,
      id: "lesson-qwen-spatial-repair",
      provider: { id: "alibaba", model: "qwen3.6-plus" },
    });

    expect(plan.steps[1]?.primitiveIds).toContain("side-arrow");
    expect(plan.primitives).toHaveLength(3);
    expect(plan.title).toBe("Find the selected angle");
  });

  it("keeps the tutorial when Qwen omits only the connector shape", () => {
    const normalized = normalizeModelLessonDraft({
      version: 1,
      title: "Use the visible triangle",
      concept: "Triangle relationships",
      summary: "Identify the marked region, then follow the explanation.",
      teachingMode: "diagram-annotation",
      confidence: "exploratory",
      sourceDescription: "The selected triangle question",
      narration: "Start with the marked part of the triangle.",
      primitives: [
        { id: "focus", kind: "circle", x: 510, y: 350, radius: 46, color: "amber" },
        {
          id: "note",
          kind: "label",
          x: 720,
          y: 150,
          width: 220,
          text: "Use the two visible sides",
          color: "violet",
        },
      ],
      steps: [
        {
          id: "locate",
          title: "Locate the target",
          narration: "First locate the marked triangle feature.",
          primitiveIds: ["focus"],
          durationMs: 1_000,
        },
        {
          id: "explain",
          title: "Connect the idea",
          narration: "Now connect that feature to the relationship in the note.",
          primitiveIds: ["note"],
          durationMs: 1_200,
        },
      ],
      controls: [],
      claims: [],
      citations: [],
      followUps: [],
    });
    const plan = validateLessonPlan({
      ...normalized,
      id: "lesson-auto-connector",
      provider: { id: "alibaba", model: "qwen3.6-plus" },
    });
    const connector = plan.primitives.find((primitive) => primitive.id.startsWith("relationship"));

    expect(connector).toMatchObject({
      kind: "curved-arrow",
      x2: 510,
      y2: 350,
      color: "cyan",
    });
    expect(plan.steps[1]?.primitiveIds).toContain(connector?.id);
    expect(plan.title).toBe("Use the visible triangle");
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
    expect(plan.primitives[0]).toMatchObject({
      id: "focus",
      kind: "rect",
      x: 0,
      y: 999,
      height: 1,
    });
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

  it("repairs a model-generated zero-length arrow without replacing the lesson", () => {
    const normalized = normalizeModelLessonDraft({
      title: "Projectile components",
      concept: "Velocity components",
      summary: "Separate horizontal and vertical motion.",
      narration: "Follow the two component arrows.",
      teachingMode: "interactive-experiment",
      confidence: "verified-module",
      sourceDescription: "A projectile diagram",
      primitives: [
        {
          id: "vy-arrow",
          kind: "arrow",
          x: 480,
          y: 420,
          x2: 480,
          y2: 420,
          text: "vertical velocity",
        },
        { id: "apex", kind: "circle", x: 480, y: 420, radius: 36 },
      ],
      steps: [
        {
          id: "components",
          title: "Split the velocity",
          narration: "The vertical component changes under gravity.",
          primitiveIds: ["vy-arrow", "apex"],
          durationMs: 2_400,
        },
      ],
      simulation: { kind: "projectile", parameters: { gravity: 9.81, speed: 24 } },
      claims: [],
      citations: [],
      followUps: [],
    });
    const plan = validateLessonPlan({
      ...normalized,
      id: "lesson-projectile",
      provider: { id: "alibaba", model: "qwen3.6-plus" },
    });
    const arrow = plan.primitives.find((primitive) => primitive.id === "vy-arrow");
    expect(arrow).toBeDefined();
    expect(
      Math.hypot((arrow?.x2 ?? 0) - (arrow?.x ?? 0), (arrow?.y2 ?? 0) - (arrow?.y ?? 0)),
    ).toBeGreaterThanOrEqual(5);
    expect(arrow?.x2).toBe(arrow?.x);
    expect(arrow?.y2).not.toBe(arrow?.y);
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
        model: "qwen/qwen3.6-27b",
        expectedType: "json_object",
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
        model: "gemma-4-31b",
        expectedType: "json_object",
        copiedText: undefined,
      },
    ] as const;

    for (const testCase of cases) {
      const lessonJson = JSON.stringify(compatiblePlan);
      const split = Math.floor(lessonJson.length / 2);
      const qwenStream = [
        { choices: [{ delta: { reasoning_content: "locating the selected objects" } }] },
        { choices: [{ delta: { content: lessonJson.slice(0, split) } }] },
        {
          choices: [{ finish_reason: "stop", delta: { content: lessonJson.slice(split) } }],
        },
      ]
        .map((item) => `data: ${JSON.stringify(item)}\n\n`)
        .join("");
      const fetchMock = vi.fn().mockResolvedValue(
        testCase.provider === "alibaba"
          ? new Response(qwenStream + "data: [DONE]\n\n", {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            })
          : new Response(
              JSON.stringify({
                choices: [{ message: { content: lessonJson } }],
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
      if (testCase.provider === "groq")
        expect(request.response_format).toEqual({ type: "json_object" });
      if (testCase.provider === "alibaba") {
        expect(request).toMatchObject({
          stream: true,
          stream_options: { include_usage: true },
          enable_thinking: false,
        });
        expect(request.max_tokens).toBeUndefined();
        expect(request.max_completion_tokens).toBeUndefined();
        expect(request.messages[0].content).toContain("Qwen response requirement");
        expect(request.messages[0].content).toContain("complete JSON object");
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

  it("loads every Gemini model page with Google authentication and keeps lesson-capable models", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: "models/gemini-3.5-flash",
                displayName: "Gemini 3.5 Flash",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-3.1-flash-tts-preview",
                displayName: "Gemini TTS",
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-embedding-001",
                supportedGenerationMethods: ["embedContent"],
              },
            ],
            nextPageToken: "page-2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              {
                name: "models/gemini-2.5-flash",
                displayName: "Gemini 2.5 Flash",
                supportedGenerationMethods: ["generateContent"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "AIza-test-google-key",
    } as unknown as SecretStore);

    const models = await service.listModels("google");

    expect(models.map((model) => model.id)).toEqual(["gemini-2.5-flash", "gemini-3.5-flash"]);
    expect(models.every((model) => model.capabilities?.vision)).toBe(true);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("pageToken=page-2");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-goog-api-key": "AIza-test-google-key",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });

  it("falls back from a complex Gemini schema rejection and still streams the vision lesson", async () => {
    const json = JSON.stringify(compatiblePlan);
    const split = Math.floor(json.length / 2);
    const stream = [
      {
        candidates: [{ content: { parts: [{ text: json.slice(0, split) }] } }],
      },
      {
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: json.slice(split) }] },
          },
        ],
      },
    ]
      .map((item) => `data: ${JSON.stringify(item)}\n\n`)
      .join("");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Response schema is too complex" } }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const progress: string[] = [];
    const service = new ProviderService({
      get: () => "AIza-test-google-key",
    } as unknown as SecretStore);
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.provider = "google";

    const plan = await service.generate({
      request: {
        captureId: "capture-gemini",
        question: "Show me the visible relationship.",
        includeNearbyContext: false,
        includeActiveWindow: false,
        researchMode: "quick",
        allowWebResearch: false,
        allowImageAids: false,
        language: "en",
        teachingStyle: "visual-fast",
        complexity: "standard",
        provider: "google",
        model: "gemini-3.5-flash",
      },
      context: {
        captureId: "capture-gemini",
        previewDataUrl: "data:image/png;base64,AA==",
        analysisDataUrl: "data:image/png;base64,AA==",
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
      progress: (message) => progress.push(message),
    });

    expect(plan.provider).toEqual({ id: "google", model: "gemini-3.5-flash" });
    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(firstUrl).toContain("gemini-3.5-flash:streamGenerateContent?alt=sse");
    expect(secondUrl).toBe(firstUrl);
    expect(firstInit.headers).toMatchObject({ "x-goog-api-key": "AIza-test-google-key" });
    const structuredRequest = JSON.parse(String(firstInit.body)) as Record<string, any>;
    expect(structuredRequest.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      maxOutputTokens: 12_000,
      thinkingConfig: { thinkingLevel: "LOW" },
    });
    expect(structuredRequest.generationConfig.responseJsonSchema).toMatchObject({ type: "object" });
    expect(structuredRequest.contents[0].parts).toEqual(
      expect.arrayContaining([{ inlineData: { mimeType: "image/png", data: "AA==" } }]),
    );
    const fallbackRequest = JSON.parse(String(secondInit.body)) as Record<string, any>;
    expect(fallbackRequest.generationConfig.responseJsonSchema).toBeUndefined();
    expect(fallbackRequest.generationConfig.responseMimeType).toBe("application/json");
    expect(fallbackRequest.systemInstruction.parts[0].text).toContain(
      "This endpoint cannot enforce a JSON response schema",
    );
    expect(progress).toContain("Gemini is simplifying the lesson format and continuing");
    expect(progress).toContain("Gemini is drawing the visual lesson");
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
      new Response(new Uint8Array(128).fill(4), {
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
      new Response(new Uint8Array(128).fill(7), {
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
    expect(url.searchParams.get("encoding")).toBe("mp3");
    expect(init.headers).toMatchObject({
      Authorization: "Token deepgram-test-key",
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
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

  it("rejects a successful speech response that is not playable audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "queued" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const service = new ProviderService({
      get: () => "deepgram-test-key",
    } as unknown as SecretStore);

    await expect(
      service.synthesize(
        "deepgram",
        "Explain the visible equation.",
        "aura-2-orion-en",
        "unused",
        1,
      ),
    ).rejects.toMatchObject({ code: "INVALID_SPEECH_AUDIO" });
  });

  it("rejects truncated narration audio before it reaches the player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      ),
    );
    const service = new ProviderService({
      get: () => "elevenlabs-test-key",
    } as unknown as SecretStore);

    await expect(
      service.synthesize(
        "elevenlabs",
        "Explain the visible equation.",
        "unused",
        "JBFqnCBsd6RMkjVDRZzb",
        1,
      ),
    ).rejects.toMatchObject({ code: "EMPTY_SPEECH_AUDIO" });
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

  it("verifies the selected ElevenLabs voice as well as the TTS model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { model_id: "scribe_v2" },
            { model_id: "eleven_flash_v2_5", can_do_text_to_speech: true },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ voice_id: DEFAULT_SETTINGS.elevenLabsVoice }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const service = new ProviderService({
      get: () => "elevenlabs-test-key",
    } as unknown as SecretStore);

    await expect(service.testSpeechService("elevenlabs", DEFAULT_SETTINGS)).resolves.toContain(
      "ElevenLabs key verified",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.elevenlabs.io/v1/voices/" + DEFAULT_SETTINGS.elevenLabsVoice,
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
