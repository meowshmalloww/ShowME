export const SAVED_CREDENTIAL_MASK = "************";

export function credentialPlaceholder(
  configured: boolean,
  emptyPlaceholder = "Paste API key",
): string {
  return configured
    ? `${SAVED_CREDENTIAL_MASK}  Saved securely — paste to replace`
    : emptyPlaceholder;
}
