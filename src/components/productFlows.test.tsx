/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_BOOTSTRAP, TEST_CONTEXT } from "../lib/testFixtures";
import { buildLessonRequest } from "../lib/lessonRequest";
import { HistoryView } from "./HistoryView";
import { HomeView } from "./HomeView";
import { moveSelectionPoints } from "./CaptureOverlay";
import { SettingsView } from "./SettingsView";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("product recovery flows", () => {
  it("starts the capture flow from the mothership", () => {
    const onNew = vi.fn();
    render(
      <HomeView
        bootstrap={TEST_BOOTSTRAP}
        onNew={onNew}
        onSettings={vi.fn()}
        onOpenRecent={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Select from screen/i }));

    expect(onNew).toHaveBeenCalledOnce();
    expect(screen.queryByText(/sample lesson/i)).not.toBeInTheDocument();
  });

  it("offers a real capture when lesson memory is empty", () => {
    const onNew = vi.fn();
    render(<HistoryView lessons={[]} onOpen={vi.fn()} onNew={onNew} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Capture region" }));

    expect(onNew).toHaveBeenCalledOnce();
  });

  it("builds a capability-safe request for the active provider", () => {
    const baseProvider = TEST_BOOTSTRAP.providers.find((item) => item.id === "openai");
    if (!baseProvider) throw new Error("OpenAI fixture is missing");
    const provider = {
      ...baseProvider,
      capabilities: {
        ...baseProvider.capabilities,
        vision: false,
        webSearch: false,
      },
    };
    const request = buildLessonRequest(
      TEST_CONTEXT,
      TEST_BOOTSTRAP.settings,
      provider,
      "  Explain the selected relationship.  ",
      {
        copiedText: "",
        sourceUrl: "",
        nearby: true,
        activeWindow: true,
        research: true,
        imageAids: false,
      },
    );

    expect(request.question).toBe("Explain the selected relationship.");
    expect(request.includeNearbyContext).toBe(false);
    expect(request.includeActiveWindow).toBe(false);
    expect(request.allowWebResearch).toBe(false);
  });

  it("guides nontechnical provider setup without endpoint or model ID fields", () => {
    render(<SettingsView bootstrap={TEST_BOOTSTRAP} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Alibaba Cloud Qwen/i }));

    expect(screen.queryByText("Model ID")).not.toBeInTheDocument();
    expect(screen.queryByText("Service endpoint")).not.toBeInTheDocument();
    expect(screen.getByText("1. Paste API key")).toBeInTheDocument();
    expect(screen.getByText("2. Choose a model")).toBeInTheDocument();
  });

  it("moves capture regions as one shape and clamps them to the screen", () => {
    expect(
      moveSelectionPoints(
        [
          { x: 100, y: 200 },
          { x: 300, y: 400 },
        ],
        { x: 200, y: 300 },
        { x: -100, y: 950 },
      ),
    ).toEqual([
      { x: 0, y: 800 },
      { x: 200, y: 1000 },
    ]);
  });
});
