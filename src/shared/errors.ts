import type { CommandErrorShape } from "./types";

export class CommandError extends Error implements CommandErrorShape {
  readonly code: string;
  readonly remediation?: string;

  constructor(code: string, message: string, remediation?: string) {
    super(message);
    this.name = "CommandError";
    this.code = code;
    if (remediation) this.remediation = remediation;
  }
}

export function formatCommandError(
  error: Pick<CommandErrorShape, "message" | "remediation">,
): string {
  const message = error.message.trim();
  const remediation = error.remediation?.trim();
  return remediation && !message.includes(remediation) ? `${message} ${remediation}` : message;
}

export function toCommandError(error: unknown): CommandErrorShape {
  if (error instanceof CommandError) {
    return {
      code: error.code,
      message: redactSecrets(error.message),
      ...(error.remediation ? { remediation: redactSecrets(error.remediation) } : {}),
    };
  }
  // Main-process bundling can put the producer and IPC boundary on different copies of this
  // class. Preserve the safe, explicit error shape even when `instanceof` cannot cross that
  // boundary, otherwise useful provider remediation is silently discarded.
  if (typeof error === "object" && error !== null) {
    const candidate = error as Record<string, unknown>;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return {
        code: candidate.code,
        message: redactSecrets(candidate.message),
        ...(typeof candidate.remediation === "string"
          ? { remediation: redactSecrets(candidate.remediation) }
          : {}),
      };
    }
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: redactSecrets(error.message) };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred." };
}

export function parseCommandError(error: unknown): CommandErrorShape {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Record<string, unknown>;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return {
        code: candidate.code,
        message: candidate.message,
        ...(typeof candidate.remediation === "string"
          ? { remediation: candidate.remediation }
          : {}),
      };
    }
  }
  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\b(sk|gsk|nvapi|or|csk|dashscope)[-_][A-Za-z0-9._-]{8,}\b/gi, "$1-[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^\s"']+/gi, "$1[REDACTED]");
}
