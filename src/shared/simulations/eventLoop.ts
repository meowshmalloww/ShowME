import type { EventLoopTraceStep } from "../types";

interface QueuedLog {
  label: string;
  value: string;
  line: number;
  phase: "microtask" | "task";
}

function extractConsoleValue(line: string): string | undefined {
  const match = line.match(/console\.log\s*\(\s*(["'`])([\s\S]*?)\1\s*\)/);
  return match?.[2];
}

export function traceEventLoop(source: string): EventLoopTraceStep[] {
  const lines = source.split(/\r?\n/);
  const trace: EventLoopTraceStep[] = [];
  const microtasks: QueuedLog[] = [];
  const tasks: QueuedLog[] = [];
  let sequence = 0;
  const nextId = () => `trace-${++sequence}`;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) return;
    const lineNumber = index + 1;
    const value = extractConsoleValue(line);

    if (/setTimeout\s*\(/.test(line)) {
      const item = {
        label: `timer from line ${lineNumber}`,
        value: value ?? "timer callback",
        line: lineNumber,
        phase: "task" as const,
      };
      tasks.push(item);
      trace.push({
        id: nextId(),
        phase: "script",
        action: "enqueue",
        label: item.label,
        value: item.value,
        line: lineNumber,
      });
      return;
    }

    if (/queueMicrotask\s*\(|\.then\s*\(/.test(line)) {
      const item = {
        label: `microtask from line ${lineNumber}`,
        value: value ?? "promise callback",
        line: lineNumber,
        phase: "microtask" as const,
      };
      microtasks.push(item);
      trace.push({
        id: nextId(),
        phase: "script",
        action: "enqueue",
        label: item.label,
        value: item.value,
        line: lineNumber,
      });
      return;
    }

    if (value !== undefined) {
      trace.push({
        id: nextId(),
        phase: "script",
        action: "log",
        label: `run line ${lineNumber}`,
        value,
        line: lineNumber,
      });
    }
  });

  for (const item of microtasks) {
    trace.push({
      id: nextId(),
      phase: item.phase,
      action: "dequeue",
      label: item.label,
      value: item.value,
      line: item.line,
    });
    trace.push({
      id: nextId(),
      phase: item.phase,
      action: "log",
      label: "execute microtask",
      value: item.value,
      line: item.line,
    });
  }

  for (const item of tasks) {
    trace.push({
      id: nextId(),
      phase: item.phase,
      action: "dequeue",
      label: item.label,
      value: item.value,
      line: item.line,
    });
    trace.push({
      id: nextId(),
      phase: item.phase,
      action: "log",
      label: "execute task",
      value: item.value,
      line: item.line,
    });
  }

  return trace;
}

export function consoleOrder(trace: EventLoopTraceStep[]): string[] {
  return trace
    .filter((step) => step.action === "log")
    .flatMap((step) => (step.value ? [step.value] : []));
}
