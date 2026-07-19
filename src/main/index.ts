import { join } from "node:path";
import { app, globalShortcut, Menu, nativeImage, nativeTheme, Tray } from "electron";
import { redactSecrets } from "../shared/errors";
import type { AppSettings } from "../shared/types";
import { CaptureService } from "./capture";
import { registerIpc } from "./ipc";
import { LessonService } from "./lesson";
import { ProviderService } from "./providers";
import { SecretStore } from "./secrets";
import { installSecurityPolicy } from "./security";
import { AppStore } from "./store";
import { WakeWordService } from "./wake-word";
import { WindowManager } from "./windows";
import { WorkerService } from "./workers";

// Keep the Electron redesign isolated from the legacy Rust/Tauri installation,
// whose application identifier and database schema are intentionally different.
app.setPath("userData", join(app.getPath("appData"), "ShowME-Redesign"));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(startApplication);
}

let tray: Tray | null = null;
let store: AppStore | null = null;
let windows: WindowManager | null = null;
let capture: CaptureService | null = null;
let wakeWord: WakeWordService | null = null;
let hotkeyBusy = false;

async function startApplication(): Promise<void> {
  app.setAppUserModelId("com.showme.desktop");
  const rootPath = app.getAppPath();
  const iconPath = join(rootPath, "assets", "icon.png");
  store = new AppStore(join(app.getPath("userData"), "showme.sqlite3"));
  const initialSettings = store.getSettings();
  nativeTheme.themeSource = initialSettings.theme;
  const secrets = new SecretStore(join(app.getPath("userData"), "credentials.bin"));
  const workers = new WorkerService(rootPath, process.resourcesPath, app.isPackaged);
  windows = new WindowManager(iconPath);
  windows.applyReducedMotion(initialSettings.reducedMotion);
  nativeTheme.on("updated", () => windows?.refreshThemeBackground());
  capture = new CaptureService(workers, () => windows?.getLauncher() ?? null);
  wakeWord = new WakeWordService(rootPath, process.resourcesPath, app.isPackaged, {
    onLevel: (level) => windows?.broadcastVoiceLevel(level),
    onWake: () => void beginWakeInteraction(),
    onStatus: (status) => {
      console.info(status.message);
      windows?.broadcastWakeStatus(status);
    },
  });
  const providers = new ProviderService(secrets);
  const lessons = new LessonService(capture, providers, workers, store, (progress) =>
    windows?.broadcastProgress(progress),
  );

  installSecurityPolicy();
  registerIpc({
    store,
    secrets,
    capture,
    providers,
    lessons,
    windows,
    workers,
    appVersion: app.getVersion(),
    onSettingsChanged: (settings) => {
      registerShortcuts(settings);
      windows?.applyTheme(settings.theme);
      windows?.applyReducedMotion(settings.reducedMotion);
      wakeWord?.configure(settings.wakeEnabled, settings.assistantName, settings.wakeSensitivity);
    },
    onVoiceActivity: handleVoiceActivity,
    getWakeStatus: () =>
      wakeWord?.currentStatus() ?? {
        state: "disabled",
        message: "Wake phrase listener is not running.",
      },
  });

  windows.createLauncher();
  registerShortcuts(initialSettings);
  wakeWord.configure(
    initialSettings.wakeEnabled,
    initialSettings.assistantName,
    initialSettings.wakeSensitivity,
  );
  createTray(iconPath);
  windows.openMain("home");

  app.on("activate", () => windows?.openMain("home"));
  app.on("second-instance", () => windows?.openMain("home"));
}

async function beginWakeInteraction(): Promise<void> {
  if (!capture || !windows) return;
  if (hotkeyBusy) {
    wakeWord?.resume();
    return;
  }
  hotkeyBusy = true;
  wakeWord?.suspend();
  windows.setLauncherMode("listening");
  windows.showLauncher(false);
  try {
    const context = await capture.captureVoiceContext();
    windows.showQuestion(context);
    windows.broadcastWakeDetected();
  } catch (error) {
    console.error(redactSecrets(error instanceof Error ? error.message : String(error)));
    windows.setLauncherMode("revealed");
    windows.showLauncher(false);
    wakeWord?.resume();
  } finally {
    hotkeyBusy = false;
  }
}

function handleVoiceActivity(state: "idle" | "listening" | "transcribing" | "speaking"): void {
  if (!windows) return;
  if (state === "idle") {
    wakeWord?.resume();
    if (["listening", "transcribing", "speaking"].includes(windows.getLauncherMode())) {
      windows.setLauncherMode("idle");
    }
    return;
  }
  wakeWord?.suspend();
  windows.setLauncherMode(state);
  windows.showLauncher(state !== "listening");
}

function registerShortcuts(settings: AppSettings): void {
  globalShortcut.unregisterAll();
  registerShortcut(settings.hotkey, async () => {
    if (!capture || !windows) return;
    const payload = await capture.begin();
    windows.openSelection(payload.display.id);
  });
  registerShortcut(settings.voiceHotkey, async () => {
    if (!capture || !windows) return;
    const context = await capture.captureVoiceContext();
    windows.showQuestion(context);
  });
}

function registerShortcut(accelerator: string, action: () => Promise<void>): void {
  try {
    globalShortcut.register(accelerator, () => {
      if (hotkeyBusy) return;
      hotkeyBusy = true;
      void action()
        .catch((error: unknown) => {
          console.error(redactSecrets(error instanceof Error ? error.message : String(error)));
          windows?.setLauncherMode("revealed");
          windows?.showLauncher(false);
        })
        .finally(() => {
          hotkeyBusy = false;
        });
    });
  } catch (error) {
    console.error("Could not register shortcut:", redactSecrets(String(error)));
  }
}

function createTray(iconPath: string): void {
  const image = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip("ShowME — turn anything visible into a lesson");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show me this",
        click: () => {
          if (!capture || !windows) return;
          void capture.begin().then((payload) => windows?.openSelection(payload.display.id));
        },
      },
      { label: "Open ShowME", click: () => windows?.openMain("home") },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          windows?.setQuitting(true);
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => {
    windows?.setLauncherMode("revealed");
    windows?.showLauncher(false);
  });
}

app.on("window-all-closed", () => {
  // ShowME stays available through the top-edge launcher and tray.
});

app.on("before-quit", () => {
  windows?.setQuitting(true);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  wakeWord?.dispose();
  tray?.destroy();
  windows?.destroyAll();
  store?.close();
  tray = null;
  store = null;
  wakeWord = null;
});

process.on("uncaughtException", (error) => {
  console.error("ShowME uncaught error:", redactSecrets(error.message));
});
process.on("unhandledRejection", (error) => {
  console.error("ShowME rejected operation:", redactSecrets(String(error)));
});
