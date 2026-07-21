import type { AppSettings } from "../../shared/types";

export interface AudioDeviceOption {
  id: string;
  label: string;
}

export function microphoneConstraints(settings: AppSettings): MediaTrackConstraints {
  return {
    ...(settings.microphoneDeviceId !== "default"
      ? { deviceId: { exact: settings.microphoneDeviceId } }
      : {}),
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  };
}

export async function openConfiguredMicrophone(
  settings: AppSettings,
): Promise<{ stream: MediaStream; fellBackToDefault: boolean }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Audio capture is not available on this system.");
  }
  try {
    return {
      stream: await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(settings),
      }),
      fellBackToDefault: false,
    };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    const missingSavedDevice =
      settings.microphoneDeviceId !== "default" &&
      ["NotFoundError", "OverconstrainedError"].includes(name);
    if (!missingSavedDevice) throw error;
    return {
      stream: await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        },
      }),
      fellBackToDefault: true,
    };
  }
}

export async function enumerateAudioDevices(
  requestAccess = false,
): Promise<{ inputs: AudioDeviceOption[]; outputs: AudioDeviceOption[] }> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  let permissionStream: MediaStream | null = null;
  try {
    if (requestAccess) {
      permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const dedupe = (kind: MediaDeviceKind): AudioDeviceOption[] => {
      const seen = new Set<string>();
      return devices.flatMap((device, index) => {
        if (device.kind !== kind || device.deviceId === "default" || seen.has(device.deviceId)) {
          return [];
        }
        seen.add(device.deviceId);
        return [
          {
            id: device.deviceId,
            label:
              device.label ||
              (kind === "audioinput" ? "Microphone " : "Speaker ") + String(index + 1),
          },
        ];
      });
    };
    return { inputs: dedupe("audioinput"), outputs: dedupe("audiooutput") };
  } finally {
    for (const track of permissionStream?.getTracks() ?? []) track.stop();
  }
}

export async function routeAudioOutput(
  element: HTMLMediaElement,
  deviceId: string,
): Promise<boolean> {
  if (deviceId === "default") return true;
  const routed = element as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (!routed.setSinkId) return false;
  try {
    await routed.setSinkId(deviceId);
    return true;
  } catch {
    try {
      await routed.setSinkId("default");
    } catch {
      // The media element already uses the system default when explicit routing is unavailable.
    }
    return false;
  }
}

export function rmsLevel(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let energy = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    energy += normalized * normalized;
  }
  return Math.sqrt(energy / samples.length);
}
