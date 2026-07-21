import { describe, expect, it, vi } from "vitest";
import {
  buildTrayMenuTemplate,
  TRAY_WAKE_MICROPHONE_ID,
  type TrayMenuActions,
  trayToolTip,
} from "../src/main/tray-menu";

function actions(): TrayMenuActions {
  return {
    beginSelection: vi.fn(),
    openApp: vi.fn(),
    setWakeMicrophoneEnabled: vi.fn(),
    quit: vi.fn(),
  };
}

describe("Windows tray microphone control", () => {
  it("shows the persisted wake-microphone state as a native checkbox", () => {
    const handlers = actions();
    const template = buildTrayMenuTemplate({
      actions: handlers,
      platform: "win32",
      wakeEnabled: true,
    });
    const microphone = template.find((item) => item.id === TRAY_WAKE_MICROPHONE_ID);

    expect(microphone).toMatchObject({
      label: "Microphone listening",
      type: "checkbox",
      checked: true,
    });
    microphone?.click?.({ checked: false } as never, undefined, {} as never);
    expect(handlers.setWakeMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it("keeps the Windows-only control out of unsupported tray menus", () => {
    const template = buildTrayMenuTemplate({
      actions: actions(),
      platform: "darwin",
      wakeEnabled: true,
    });

    expect(template.some((item) => item.id === TRAY_WAKE_MICROPHONE_ID)).toBe(false);
  });

  it("makes the hover status unambiguous when microphone standby is off", () => {
    expect(trayToolTip(true, "win32")).toContain("microphone listening");
    expect(trayToolTip(false, "win32")).toBe("ShowME — microphone listening off");
  });
});
