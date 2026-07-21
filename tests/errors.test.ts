import { describe, expect, it } from "vitest";
import { formatCommandError, toCommandError } from "../src/shared/errors";

describe("IPC command error serialization", () => {
  it("preserves remediation from a command-like error across bundle boundaries", () => {
    const boundaryError = Object.assign(new Error("NVIDIA NIM: Authorization failed (HTTP 403)"), {
      code: "PROVIDER_ACCESS_DENIED",
      remediation:
        "The organization needs hosted Public API Endpoints access. Key nvapi-secret-value stays private.",
    });

    expect(toCommandError(boundaryError)).toEqual({
      code: "PROVIDER_ACCESS_DENIED",
      message: "NVIDIA NIM: Authorization failed (HTTP 403)",
      remediation:
        "The organization needs hosted Public API Endpoints access. Key nvapi-[REDACTED] stays private.",
    });
  });

  it("formats remediation into a bridge-safe message exactly once", () => {
    const remediation = "Enable Public API Endpoints for the selected NVIDIA organization.";
    expect(formatCommandError({ message: "Authorization failed (HTTP 403)", remediation })).toBe(
      `Authorization failed (HTTP 403) ${remediation}`,
    );
    expect(
      formatCommandError({
        message: `Authorization failed (HTTP 403) ${remediation}`,
        remediation,
      }),
    ).toBe(`Authorization failed (HTTP 403) ${remediation}`);
  });
});
