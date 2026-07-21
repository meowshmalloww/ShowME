import { describe, expect, it } from "vitest";
import { credentialPlaceholder, SAVED_CREDENTIAL_MASK } from "../src/shared/credential-display";

describe("credential display", () => {
  it("confirms a configured credential with a fixed non-secret mask", () => {
    const placeholder = credentialPlaceholder(true);

    expect(SAVED_CREDENTIAL_MASK.length).toBeGreaterThanOrEqual(5);
    expect(placeholder).toContain(SAVED_CREDENTIAL_MASK);
    expect(placeholder).toContain("Saved securely");
    expect(placeholder).toContain("paste to replace");
  });

  it("keeps an unconfigured field explicit", () => {
    expect(credentialPlaceholder(false)).toBe("Paste API key");
    expect(credentialPlaceholder(false, "Paste provider key")).toBe("Paste provider key");
  });
});
