import type { AppSettings, CredentialId, VoiceInputProvider, VoiceServiceSummary } from "./types";

const DEFINITIONS: ReadonlyArray<Omit<VoiceServiceSummary, "configured">> = [
  {
    id: "groq",
    name: "Groq",
    speechToText: true,
    textToSpeech: false,
  },
  {
    id: "deepgram",
    name: "Deepgram",
    speechToText: true,
    textToSpeech: true,
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    speechToText: true,
    textToSpeech: true,
  },
];

export function voiceServiceSummaries(
  configured: Partial<Record<CredentialId, boolean>>,
): VoiceServiceSummary[] {
  return DEFINITIONS.map((service) => ({
    ...service,
    configured: Boolean(configured[service.id]),
  }));
}

export function voiceServiceName(provider: VoiceInputProvider): string {
  return DEFINITIONS.find((service) => service.id === provider)?.name ?? provider;
}

export function reconcileVoiceRoutes(
  settings: AppSettings,
  configured: Partial<Record<CredentialId, boolean>>,
): AppSettings {
  const independent = (["deepgram", "elevenlabs"] as const).filter((id) => configured[id]);
  const voiceInputProvider = configured[settings.voiceInputProvider]
    ? settings.voiceInputProvider
    : (independent[0] ?? settings.voiceInputProvider);
  const voiceOutputProvider =
    settings.voiceOutputProvider === "system" || configured[settings.voiceOutputProvider]
      ? settings.voiceOutputProvider
      : (independent[0] ?? "system");
  return { ...settings, voiceInputProvider, voiceOutputProvider };
}
