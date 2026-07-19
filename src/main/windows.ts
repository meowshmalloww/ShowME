import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, nativeTheme, screen } from "electron";
import { redactSecrets } from "../shared/errors";
import { CHANNELS } from "../shared/ipc";
import { launcherSize } from "../shared/launcher";
import type {
  LauncherMode,
  LessonPresentation,
  LessonProgress,
  LessonSurface,
  PreparedContext,
  WakeListenerStatus,
  WindowRole,
} from "../shared/types";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export class WindowManager {
  private main: BrowserWindow | null = null;
  private launcher: BrowserWindow | null = null;
  private selection: BrowserWindow | null = null;
  private lesson: BrowserWindow | null = null;
  private launcherMode: LauncherMode = "idle";
  private launcherAnimation: ReturnType<typeof setTimeout> | null = null;
  private reducedMotion = false;
  private quitting = false;

  constructor(private readonly iconPath: string) {}

  setQuitting(value: boolean): void {
    this.quitting = value;
  }

  getLauncher(): BrowserWindow | null {
    return this.launcher && !this.launcher.isDestroyed() ? this.launcher : null;
  }

  getLauncherMode(): LauncherMode {
    return this.launcherMode;
  }

  createLauncher(): BrowserWindow {
    if (this.getLauncher()) return this.launcher as BrowserWindow;
    const initialSize = launcherSize("idle");
    const window = this.createWindow("launcher", {
      ...initialSize,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      thickFrame: false,
      roundedCorners: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      focusable: true,
      show: false,
    });
    this.launcher = window;
    window.setAlwaysOnTop(true, "floating", 1);
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on("closed", () => {
      this.launcher = null;
    });
    window.webContents.once("did-finish-load", () => {
      this.positionLauncher();
      window.showInactive();
    });
    return window;
  }

  openMain(section: "home" | "library" | "settings" = "home"): BrowserWindow {
    if (!this.main || this.main.isDestroyed()) {
      this.main = this.createWindow("main", {
        width: 1180,
        height: 780,
        minWidth: 920,
        minHeight: 640,
        frame: false,
        titleBarStyle: "hidden",
        backgroundColor: windowBackground(),
        show: false,
      });
      this.main.on("close", (event) => {
        if (!this.quitting) {
          event.preventDefault();
          this.main?.hide();
        }
      });
      this.main.on("closed", () => {
        this.main = null;
      });
      this.main.webContents.once("did-finish-load", () => this.main?.show());
    }
    this.main.show();
    this.main.focus();
    this.main.webContents.send(CHANNELS.eventNavigate, section);
    return this.main;
  }

  openSelection(displayId: number): BrowserWindow {
    this.closeSelection();
    const display =
      screen.getAllDisplays().find((item) => item.id === displayId) ?? screen.getPrimaryDisplay();
    const window = this.createWindow("selection", {
      ...display.bounds,
      frame: false,
      transparent: false,
      backgroundColor: "#05060a",
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
    });
    this.selection = window;
    window.setAlwaysOnTop(true, "screen-saver");
    window.on("closed", () => {
      this.selection = null;
    });
    window.webContents.once("did-finish-load", () => {
      window.setBounds(display.bounds);
      window.show();
      window.focus();
    });
    return window;
  }

  closeSelection(): void {
    if (this.selection && !this.selection.isDestroyed()) this.selection.destroy();
    this.selection = null;
  }

  showQuestion(context: PreparedContext): void {
    this.closeSelection();
    this.setLauncherMode("question");
    this.launcher?.webContents.send(CHANNELS.eventContextReady, context);
    this.launcher?.show();
    this.launcher?.focus();
  }

  setLauncherMode(mode: LauncherMode): void {
    const previousMode = this.launcherMode;
    this.launcherMode = mode;
    const launcher = this.createLauncher();
    launcher.webContents.send(CHANNELS.eventLauncherMode, mode);
    if (previousMode === mode || launcher.webContents.isLoadingMainFrame()) {
      this.positionLauncher();
      return;
    }
    this.animateLauncher();
  }

  showLauncher(inactive = true): void {
    if (!this.launcherAnimation) this.positionLauncher();
    if (inactive) this.launcher?.showInactive();
    else {
      this.launcher?.show();
      this.launcher?.focus();
    }
  }

  hideLauncher(): void {
    this.launcher?.hide();
  }

  applyTheme(theme: "system" | "light" | "dark"): void {
    nativeTheme.themeSource = theme;
    this.refreshThemeBackground();
  }

  applyReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  refreshThemeBackground(): void {
    const color = windowBackground();
    for (const window of [this.main, this.lesson]) {
      if (window && !window.isDestroyed()) window.setBackgroundColor(color);
    }
  }

  showLesson(presentation: LessonPresentation): BrowserWindow {
    if (!this.lesson || this.lesson.isDestroyed()) {
      this.lesson = this.createWindow("lesson", {
        width: 540,
        height: 780,
        minWidth: 420,
        minHeight: 520,
        frame: false,
        transparent: false,
        backgroundColor: windowBackground(),
        alwaysOnTop: false,
        show: false,
      });
      this.lesson.on("closed", () => {
        this.lesson = null;
      });
    }
    this.positionLesson(presentation.surface);
    const send = (): void => {
      this.lesson?.webContents.send(CHANNELS.eventLessonReady, presentation);
      this.lesson?.show();
      this.lesson?.focus();
    };
    if (this.lesson.webContents.isLoadingMainFrame())
      this.lesson.webContents.once("did-finish-load", send);
    else send();
    return this.lesson;
  }

  setLessonSurface(surface: LessonSurface): void {
    this.positionLesson(surface);
  }

  closeLesson(): void {
    this.lesson?.hide();
  }

  broadcastProgress(progress: LessonProgress): void {
    for (const window of [this.launcher, this.lesson, this.main]) {
      if (window && !window.isDestroyed())
        window.webContents.send(CHANNELS.eventLessonProgress, progress);
    }
  }

  broadcastSettings(settings: unknown): void {
    for (const window of [this.launcher, this.lesson, this.main]) {
      if (window && !window.isDestroyed())
        window.webContents.send(CHANNELS.eventSettingsChanged, settings);
    }
  }

  broadcastVoiceLevel(level: number): void {
    const launcher = this.getLauncher();
    if (launcher) launcher.webContents.send(CHANNELS.eventVoiceLevel, level);
  }

  broadcastWakeDetected(): void {
    const launcher = this.getLauncher();
    if (launcher) launcher.webContents.send(CHANNELS.eventWakeDetected);
  }

  broadcastWakeStatus(status: WakeListenerStatus): void {
    for (const window of [this.launcher, this.main]) {
      if (window && !window.isDestroyed()) {
        window.webContents.send(CHANNELS.eventWakeStatus, status);
      }
    }
  }

  windowAction(sender: Electron.WebContents, action: "minimize" | "maximize" | "close"): void {
    const window = BrowserWindow.fromWebContents(sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    else if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (window === this.main || window === this.lesson) window.hide();
    else window.close();
  }

  destroyAll(): void {
    if (this.launcherAnimation) clearTimeout(this.launcherAnimation);
    this.launcherAnimation = null;
    for (const window of [this.selection, this.lesson, this.main, this.launcher]) {
      if (window && !window.isDestroyed()) window.destroy();
    }
  }

  private positionLauncher(): void {
    const launcher = this.getLauncher();
    if (!launcher) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const size = launcherSize(this.launcherMode);
    const x = Math.round(display.workArea.x + (display.workArea.width - size.width) / 2);
    const y = display.workArea.y;
    launcher.setBounds({ x, y, ...size }, false);
    this.applyLauncherShape(launcher, size);
  }

  private animateLauncher(): void {
    const launcher = this.getLauncher();
    if (!launcher) return;
    if (this.launcherAnimation) clearTimeout(this.launcherAnimation);
    this.launcherAnimation = null;

    const start = launcher.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: Math.round(start.x + start.width / 2),
      y: start.y,
    });
    const size = launcherSize(this.launcherMode);
    const target = {
      x: Math.round(display.workArea.x + (display.workArea.width - size.width) / 2),
      y: display.workArea.y,
      ...size,
    };
    if (this.reducedMotion) {
      launcher.setBounds(target, false);
      this.applyLauncherShape(launcher, size);
      return;
    }

    if (this.launcherMode !== "idle") this.applyLauncherShape(launcher, size);

    const startedAt = performance.now();
    const duration =
      this.launcherMode === "question" ? 220 : this.launcherMode === "idle" ? 160 : 190;
    const tick = (): void => {
      const current = this.getLauncher();
      if (!current) {
        this.launcherAnimation = null;
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 4;
      current.setBounds(
        {
          x: interpolate(start.x, target.x, eased),
          y: interpolate(start.y, target.y, eased),
          width: interpolate(start.width, target.width, eased),
          height: interpolate(start.height, target.height, eased),
        },
        false,
      );
      if (progress < 1) this.launcherAnimation = setTimeout(tick, 16);
      else {
        this.applyLauncherShape(current, size);
        this.launcherAnimation = null;
      }
    };
    tick();
  }

  private applyLauncherShape(
    launcher: BrowserWindow,
    size: { width: number; height: number },
  ): void {
    if (process.platform !== "win32") return;
    launcher.setShape([{ x: 0, y: 0, width: size.width, height: size.height }]);
  }

  private positionLesson(surface: LessonSurface): void {
    if (!this.lesson || this.lesson.isDestroyed()) return;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = display.workArea;
    if (surface === "focus") {
      const width = Math.min(1180, area.width - 64);
      const height = Math.min(820, area.height - 64);
      this.lesson.setBounds({
        x: Math.round(area.x + (area.width - width) / 2),
        y: Math.round(area.y + (area.height - height) / 2),
        width,
        height,
      });
      return;
    }
    const width =
      surface === "inline" ? Math.min(680, area.width - 40) : Math.min(560, area.width - 40);
    const height = surface === "inline" ? Math.min(520, area.height - 40) : area.height - 24;
    this.lesson.setBounds({
      x: area.x + area.width - width - 12,
      y: surface === "inline" ? area.y + area.height - height - 12 : area.y + 12,
      width,
      height,
    });
  }

  private createWindow(
    role: WindowRole,
    options: Electron.BrowserWindowConstructorOptions,
  ): BrowserWindow {
    const window = new BrowserWindow({
      ...options,
      icon: this.iconPath,
      title:
        role === "launcher"
          ? "ShowME Island"
          : role === "lesson"
            ? "ShowME Lesson"
            : role === "selection"
              ? "ShowME Selection"
              : "ShowME",
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(moduleDirectory, "../preload/index.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false,
      },
    });
    window.on("page-title-updated", (event) => event.preventDefault());
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-attach-webview", (event) => event.preventDefault());
    window.webContents.on("did-fail-load", (_event, code, description, url) => {
      console.error(`[${role}] failed to load ${url}: ${code} ${description}`);
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      console.error(`[${role}] renderer stopped: ${details.reason}`);
    });
    window.webContents.on("console-message", (event) => {
      if (event.level === "error") {
        console.error(`[${role}] ${redactSecrets(event.message)}`);
      }
    });
    this.load(window, role);
    return window;
  }

  private load(window: BrowserWindow, role: WindowRole): void {
    const developmentUrl = process.env.ELECTRON_RENDERER_URL;
    if (developmentUrl) {
      const url = new URL(developmentUrl);
      url.searchParams.set("role", role);
      void window.loadURL(url.toString());
    } else {
      void window.loadFile(join(moduleDirectory, "../renderer/index.html"), { query: { role } });
    }
  }
}

function interpolate(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff";
}
