import { describe, expect, it } from "vitest";
import { isLikelyNarrationEcho, parseVoiceLessonCommand } from "../src/shared/voice-command";

describe("spoken lesson commands", () => {
  it("accepts natural adaptation phrases with an optional wake prefix", () => {
    expect(parseVoiceLessonCommand("Hey Show Me, I still don't get it")).toMatchObject({
      kind: "adapt",
      adaptation: "simpler",
    });
    expect(parseVoiceLessonCommand("slow down")).toMatchObject({
      kind: "adapt",
      adaptation: "slower",
    });
    expect(parseVoiceLessonCommand("Show me the math")).toMatchObject({
      kind: "adapt",
      adaptation: "show-math",
    });
  });

  it("turns a concise spoken question into a follow-up", () => {
    expect(parseVoiceLessonCommand("Why do we use inverse tangent here?")).toEqual({
      kind: "adapt",
      adaptation: "question",
      question: "Why do we use inverse tangent here?",
      inferredQuestion: true,
    });
  });

  it("lets the learner clear the whiteboard without touching the screen", () => {
    expect(parseVoiceLessonCommand("Show me, clear the screen please")).toEqual({
      kind: "clear",
    });
    expect(parseVoiceLessonCommand("erase the board")).toEqual({ kind: "clear" });
  });

  it("rejects unrelated room speech and detects narration echo", () => {
    expect(parseVoiceLessonCommand("the answer is on the screen")).toBeNull();
    expect(
      isLikelyNarrationEcho(
        "the opposite side is eleven point nine",
        "Now the opposite side is eleven point nine, and the adjacent side is ten.",
      ),
    ).toBe(true);
  });
});
