import type { MenuItem, MenuItemConstructorOptions } from "electron";

export const TRAY_WAKE_MICROPHONE_ID = "wake-microphone";

export interface TrayMenuActions {
  beginSelection: () => void;
  openApp: () => void;
  setWakeMicrophoneEnabled: (enabled: boolean) => void;
  quit: () => void;
}

interface TrayMenuOptions {
  actions: TrayMenuActions;
  platform: NodeJS.Platform;
  wakeEnabled: boolean;
}

export function buildTrayMenuTemplate({
  actions,
  platform,
  wakeEnabled,
}: TrayMenuOptions): MenuItemConstructorOptions[] {
  return [
    { label: "Show me this", click: actions.beginSelection },
    { label: "Open ShowME", click: actions.openApp },
    ...(platform === "win32"
      ? [
          { type: "separator" as const },
          {
            id: TRAY_WAKE_MICROPHONE_ID,
            label: "Microphone listening",
            type: "checkbox" as const,
            checked: wakeEnabled,
            click: (menuItem: MenuItem) => actions.setWakeMicrophoneEnabled(menuItem.checked),
          },
        ]
      : []),
    { type: "separator" },
    { label: "Quit", click: actions.quit },
  ];
}

export function trayToolTip(wakeEnabled: boolean, platform: NodeJS.Platform): string {
  if (platform !== "win32") return "ShowME — turn anything visible into a lesson";
  return wakeEnabled
    ? "ShowME — microphone listening for ‘Show me’"
    : "ShowME — microphone listening off";
}
