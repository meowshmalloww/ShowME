import { describe, expect, it } from "vitest";
import { consoleOrder, traceEventLoop } from "./eventLoop";

describe("event loop tracer", () => {
  it("drains script logs, then microtasks, then task callbacks", () => {
    const source = `
console.log("script")
setTimeout(() => console.log("timer"), 0)
queueMicrotask(() => console.log("microtask"))
`;
    const trace = traceEventLoop(source);
    expect(consoleOrder(trace)).toEqual(["script", "microtask", "timer"]);
    expect(trace.some((step) => step.phase === "microtask" && step.action === "dequeue")).toBe(
      true,
    );
    expect(trace.some((step) => step.phase === "task" && step.action === "dequeue")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    expect(traceEventLoop("// nothing\n\n")).toEqual([]);
  });
});
