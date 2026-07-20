import type { CredentialId, VoiceInputProvider, VoiceServiceSummary } from "./types";

const DEFINITIONS: ReadonlyArray<Omit<VoiceServiceSummary, "configured">> = [
  {
    id: "openai",
    name: "OpenAI",
    speechToText: true,
    textToSpeech: true,
  },
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
    textToSpeech: false,
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
