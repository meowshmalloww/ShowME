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

export function toCommandError(error: unknown): CommandErrorShape {
  if (error instanceof CommandError) {
    return {
      code: error.code,
      message: redactSecrets(error.message),
      ...(error.remediation ? { remediation: redactSecrets(error.remediation) } : {}),
    };
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
