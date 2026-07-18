/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_BOOTSTRAP, DEMO_CONTEXT } from "../lib/demo";
import { buildLessonRequest } from "../lib/lessonRequest";
import { HistoryView } from "./HistoryView";
import { HomeView } from "./HomeView";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("product recovery flows", () => {
  it("starts the capture flow from the mothership", () => {
    const onNew = vi.fn();
    render(
      <HomeView
        bootstrap={DEMO_BOOTSTRAP}
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
    const baseProvider = DEMO_BOOTSTRAP.providers.find((item) => item.id === "openai");
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
      DEMO_CONTEXT,
      DEMO_BOOTSTRAP.settings,
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
});
