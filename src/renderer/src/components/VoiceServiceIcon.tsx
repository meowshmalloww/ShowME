import { siDeepgram, siElevenlabs } from "simple-icons";
import type { VoiceInputProvider } from "../../../shared/types";
import { ProviderIcon } from "./ProviderIcon";

export function VoiceServiceIcon({
  provider,
  size = 20,
}: {
  provider: VoiceInputProvider;
  size?: number;
}) {
  if (provider === "openai" || provider === "groq") {
    return <ProviderIcon provider={provider} size={size} />;
  }
  const path = provider === "deepgram" ? siDeepgram.path : siElevenlabs.path;
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
