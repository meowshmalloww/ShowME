import type { CommandError } from "./types";

export class ShowMeError extends Error {
  readonly code: string;
  readonly remediation?: string;

  constructor(error: CommandError) {
    super(error.message);
    this.name = "ShowMeError";
    this.code = error.code;
    this.remediation = error.remediation;
  }
}

export function normalizeCommandError(value: unknown): ShowMeError {
  if (value instanceof ShowMeError) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Partial<CommandError>;
      if (parsed.code && parsed.message) {
        return new ShowMeError({
          code: parsed.code,
          message: parsed.message,
          remediation: parsed.remediation,
        });
      }
    } catch {
      return new ShowMeError({ code: "UNKNOWN", message: value });
    }
  }
  if (typeof value === "object" && value !== null && "message" in value) {
    const candidate = value as Partial<CommandError>;
    return new ShowMeError({
      code: candidate.code ?? "UNKNOWN",
      message: String(candidate.message),
      remediation: candidate.remediation,
    });
  }
  return new ShowMeError({ code: "UNKNOWN", message: "An unexpected desktop error occurred." });
}

export function commandErrorMessage(value: unknown): string {
  const error = normalizeCommandError(value);
  return error.remediation ? `${error.message} ${error.remediation}` : error.message;
}
