import { describe, expect, it } from "vitest";
import {
  extractCompatibleText,
  extractOpenAiResponse,
  supportsReasoningControl,
} from "../src/main/providers";
import { DEFAULT_SETTINGS } from "../src/shared/defaults";
import { effectiveCapabilities, providerSummaries } from "../src/shared/providers";

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
  });
});
