import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, globalShortcut, nativeTheme, screen } from "electron";
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
  private screenReading: BrowserWindow | null = null;
  private launcherMode: LauncherMode = "idle";
  private launcherAnimation: ReturnType<typeof setTimeout> | null = null;
  private launcherRecovery: ReturnType<typeof setTimeout> | null = null;
  private lessonDisplayId: number | null = null;
  private lessonEscapeRegistered = false;
  private notifyWhenLessonCloses = true;
  private reducedMotion = false;
  private quitting = false;

  constructor(
    private readonly iconPath: string,
    private readonly onLessonClosed: () => void = () => undefined,
  ) {
    screen.on("display-added", this.handleDisplayChange);
    screen.on("display-removed", this.handleDisplayChange);
    screen.on("display-metrics-changed", this.handleDisplayChange);
  }

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
    window.setAlwaysOnTop(true, "screen-saver", 3);
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on("closed", () => {
      if (this.launcher === window) this.launcher = null;
      if (!this.quitting) this.scheduleLauncherRecovery();
    });
    window.webContents.once("did-finish-load", () => {
      window.webContents.send(CHANNELS.eventLauncherMode, this.launcherMode);
      this.positionLauncher();
      window.showInactive();
    });
    window.webContents.on("render-process-gone", () => {
      if (this.launcher !== window || this.quitting) return;
      this.scheduleLauncherRecovery(true);
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
    let loaded = false;
    const loadGuard = setTimeout(() => {
      if (loaded || this.selection !== window || this.quitting) return;
      window.destroy();
      this.setLauncherMode("revealed");
      this.showLauncher(false);
    }, 3_000);
    window.on("closed", () => {
      clearTimeout(loadGuard);
      this.selection = null;
    });
    window.webContents.once("did-finish-load", () => {
      loaded = true;
      clearTimeout(loadGuard);
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
    this.showLauncher(false);
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
    const launcher = this.createLauncher();
    if (!this.launcherAnimation) this.positionLauncher();
    launcher.setAlwaysOnTop(true, "screen-saver", 3);
    launcher.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (launcher.webContents.isLoadingMainFrame()) {
      launcher.webContents.once("did-finish-load", () => this.showLauncher(inactive));
      return;
    }
    if (inactive) launcher.showInactive();
    else {
      launcher.show();
      launcher.focus();
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
    for (const window of [this.main]) {
      if (window && !window.isDestroyed()) window.setBackgroundColor(color);
    }
  }

  showLesson(presentation: LessonPresentation): BrowserWindow {
    const display = this.lessonDisplay(presentation);
    this.lessonDisplayId = display.id;
    this.main?.hide();
    if (!this.lesson || this.lesson.isDestroyed()) {
      this.lesson = this.createWindow("lesson", {
        ...display.bounds,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        enableLargerThanScreen: true,
        show: false,
      });
      const lesson = this.lesson;
      lesson.setIgnoreMouseEvents(true, { forward: true });
      lesson.setAlwaysOnTop(true, "screen-saver", 1);
      lesson.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      lesson.on("closed", () => {
        if (this.lesson !== lesson) return;
        const notify = this.notifyWhenLessonCloses;
        this.notifyWhenLessonCloses = true;
        this.lesson = null;
        this.lessonDisplayId = null;
        this.unregisterLessonEscape();
        if (!this.quitting && notify) this.onLessonClosed();
      });
    }
    this.positionLesson(display.id);
    this.lesson.setIgnoreMouseEvents(true, { forward: true });
    this.lesson.setAlwaysOnTop(true, "screen-saver", 1);
    this.lesson.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.registerLessonEscape();
    const send = (): void => {
      this.lesson?.webContents.send(CHANNELS.eventLessonReady, presentation);
      this.lesson?.showInactive();
    };
    if (this.lesson.webContents.isLoadingMainFrame())
      this.lesson.webContents.once("did-finish-load", send);
    else send();
    return this.lesson;
  }

  setLessonSurface(_surface: LessonSurface): void {
    if (this.lessonDisplayId !== null) this.positionLesson(this.lessonDisplayId);
  }

  setLessonInteractive(interactive: boolean): void {
    const lesson = this.lesson;
    if (!lesson || lesson.isDestroyed()) return;
    lesson.setIgnoreMouseEvents(!interactive, interactive ? undefined : { forward: true });
  }

  closeLesson(notify = true): void {
    const lesson = this.lesson;
    if (lesson && !lesson.isDestroyed()) {
      this.notifyWhenLessonCloses = notify;
      lesson.destroy();
    }
  }

  hasLesson(): boolean {
    return Boolean(this.lesson && !this.lesson.isDestroyed());
  }

  showScreenReading(displayId: number): void {
    this.hideScreenReading();
    const display =
      screen.getAllDisplays().find((item) => item.id === displayId) ?? screen.getPrimaryDisplay();
    const window = this.createWindow("screen-reading", {
      ...display.bounds,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
    });
    this.screenReading = window;
    window.setIgnoreMouseEvents(true, { forward: true });
    window.setAlwaysOnTop(true, "screen-saver", 2);
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on("closed", () => {
      if (this.screenReading === window) this.screenReading = null;
    });
    window.webContents.once("did-finish-load", () => {
      if (this.screenReading !== window || window.isDestroyed()) return;
      window.setBounds(display.bounds);
      window.showInactive();
    });
  }

  hideScreenReading(): void {
    const window = this.screenReading;
    this.screenReading = null;
    if (window && !window.isDestroyed()) window.destroy();
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

  broadcastWakeDetected(context: PreparedContext): void {
    const launcher = this.getLauncher();
    if (launcher) launcher.webContents.send(CHANNELS.eventWakeDetected, context);
  }

  broadcastWakeStatus(status: WakeListenerStatus): void {
    for (const window of [this.launcher, this.main]) {
      if (window && !window.isDestroyed()) {
        window.webContents.send(CHANNELS.eventWakeStatus, status);
      }
    }
  }

  broadcastVoiceCommand(phrase: string, confidence: number): void {
    const lesson = this.lesson;
    if (!lesson || lesson.isDestroyed()) return;
    lesson.webContents.send(CHANNELS.eventVoiceCommand, {
      phrase: phrase.slice(0, 500),
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }

  broadcastVoicePlaybackError(message: string): void {
    const launcher = this.getLauncher();
    if (launcher) launcher.webContents.send(CHANNELS.eventVoicePlaybackError, message);
  }

  windowAction(sender: Electron.WebContents, action: "minimize" | "maximize" | "close"): void {
    const window = BrowserWindow.fromWebContents(sender);
    if (!window) return;
    if (action === "minimize") window.minimize();
    else if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (window === this.lesson) this.closeLesson();
    else if (window === this.main) window.hide();
    else window.close();
  }

  destroyAll(): void {
    this.quitting = true;
    if (this.launcherAnimation) clearTimeout(this.launcherAnimation);
    this.launcherAnimation = null;
    if (this.launcherRecovery) clearTimeout(this.launcherRecovery);
    this.launcherRecovery = null;
    this.unregisterLessonEscape();
    screen.removeListener("display-added", this.handleDisplayChange);
    screen.removeListener("display-removed", this.handleDisplayChange);
    screen.removeListener("display-metrics-changed", this.handleDisplayChange);
    for (const window of [
      this.screenReading,
      this.selection,
      this.lesson,
      this.main,
      this.launcher,
    ]) {
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

  private readonly handleDisplayChange = (): void => {
    if (!this.launcherAnimation) this.positionLauncher();
    if (this.lessonDisplayId !== null) this.positionLesson(this.lessonDisplayId);
  };

  private scheduleLauncherRecovery(reload = false): void {
    if (this.launcherRecovery || this.quitting) return;
    this.launcherRecovery = setTimeout(() => {
      this.launcherRecovery = null;
      if (this.quitting) return;
      const launcher = this.getLauncher();
      if (reload && launcher) {
        launcher.webContents.once("did-finish-load", () => {
          launcher.webContents.send(CHANNELS.eventLauncherMode, this.launcherMode);
          this.positionLauncher();
          this.showLauncher();
        });
        launcher.webContents.reload();
        return;
      }
      this.createLauncher();
      this.showLauncher();
    }, 120);
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

  private positionLesson(displayId: number): void {
    if (!this.lesson || this.lesson.isDestroyed()) return;
    const display =
      screen.getAllDisplays().find((candidate) => candidate.id === displayId) ??
      screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    this.lessonDisplayId = display.id;
    this.lesson.setBounds(display.bounds, false);
  }

  private lessonDisplay(presentation: LessonPresentation): Electron.Display {
    const id = presentation.contextGeometry?.display.id;
    return (
      (id === undefined
        ? undefined
        : screen.getAllDisplays().find((candidate) => candidate.id === id)) ??
      screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    );
  }

  private registerLessonEscape(): void {
    if (this.lessonEscapeRegistered) return;
    if (globalShortcut.isRegistered("Escape")) return;
    this.lessonEscapeRegistered = globalShortcut.register("Escape", () => this.closeLesson());
  }

  private unregisterLessonEscape(): void {
    if (!this.lessonEscapeRegistered) return;
    globalShortcut.unregister("Escape");
    this.lessonEscapeRegistered = false;
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
              : role === "screen-reading"
                ? "ShowME Screen Reading Indicator"
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
        backgroundThrottling: role !== "launcher" && role !== "lesson" && role !== "screen-reading",
        autoplayPolicy: "no-user-gesture-required",
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
