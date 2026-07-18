import { listen } from "@tauri-apps/api/event";
import {
  Crosshair,
  EyeOff,
  Mic,
  MicOff,
  MoreHorizontal,
  RefreshCw,
  Send,
  Settings,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording, type RecordingSession } from "../lib/audio";
import { desktop, isTauriRuntime } from "../lib/api";
import { commandErrorMessage } from "../lib/errors";
import { buildLessonRequest } from "../lib/lessonRequest";
import { validateLessonPlan } from "../lib/schema";
import type { AppBootstrap, AppSettings, CapturePayload, PreparedContext } from "../lib/types";
import { BrandGlyph } from "./Chrome";

export function PetView() {
  const [bootstrap, setBootstrap] = useState<AppBootstrap>();
  const [context, setContext] = useState<PreparedContext>();
  const [expanded, setExpanded] = useState(false);
  const [launcherHovered, setLauncherHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [copiedText, setCopiedText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [nearby, setNearby] = useState(false);
  const [activeWindow, setActiveWindow] = useState(false);
  const [research, setResearch] = useState(false);
  const [imageAids, setImageAids] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const recordingSession = useRef<RecordingSession | undefined>(undefined);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settings = bootstrap?.settings;
  const launcherScale = settings?.petScale;
  const provider = bootstrap?.providers.find((item) => item.id === settings?.provider);
  const launcherLabel = settings?.petName.trim() || "ShowME";
  const launcherRevealed = launcherHovered || menuOpen || capturing || Boolean(error);
  const launcherMode = expanded
    ? "panel"
    : menuOpen || capturing || error
      ? "menu"
      : launcherRevealed
        ? "ready"
        : "peek";

  const applyBootstrap = useCallback((next: AppBootstrap) => {
    setBootstrap(next);
    setNearby(next.settings.nearbyContextDefault);
    setActiveWindow(next.settings.activeWindowDefault);
    setResearch(next.settings.webResearchDefault);
    setImageAids(next.settings.imageAidsDefault);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("pet-window-root");
    document.body.classList.add("pet-window-root");
    return () => {
      document.documentElement.classList.remove("pet-window-root");
      document.body.classList.remove("pet-window-root");
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let active = true;
    const unlisteners: (() => void)[] = [];
    desktop
      .bootstrap()
      .then((value) => active && applyBootstrap(value))
      .catch((value) => active && setError(commandErrorMessage(value)));
    desktop
      .preparedContext()
      .then((value) => {
        if (active && value) {
          setContext(value);
          setExpanded(true);
        }
      })
      .catch(() => undefined);
    Promise.all([
      listen<CapturePayload>("showme:capture-ready", async () => {
        const prepared = await desktop.preparedContext();
        if (!prepared) return;
        setContext(prepared);
        setExpanded(true);
        setCapturing(false);
        setQuestion("");
        setError(undefined);
        window.setTimeout(() => inputRef.current?.focus(), 180);
      }),
      listen<AppSettings>("showme:settings-changed", async () => {
        applyBootstrap(await desktop.bootstrap());
      }),
    ]).then((items) => {
      if (active) unlisteners.push(...items);
      else
        items.forEach((unlisten) => {
          unlisten();
        });
    });
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => {
        unlisten();
      });
      recordingSession.current?.cancel();
    };
  }, [applyBootstrap]);

  useEffect(() => {
    if (isTauriRuntime() && launcherScale !== undefined) {
      desktop.setLauncherMode(launcherMode).catch(() => undefined);
    }
  }, [launcherMode, launcherScale]);

  const startCapture = async () => {
    if (capturing || generating) return;
    setMenuOpen(false);
    setError(undefined);
    setCapturing(true);
    try {
      if (!isTauriRuntime()) throw new Error("Screen capture is available in the desktop app.");
      await desktop.endLessonContext();
      setContext(undefined);
      await desktop.beginCapture();
    } catch (value) {
      setCapturing(false);
      setError(commandErrorMessage(value));
    }
  };

  const toggleRecording = async () => {
    setError(undefined);
    try {
      if (!recording) {
        recordingSession.current = await startRecording();
        setRecording(true);
        return;
      }
      setRecording(false);
      setTranscribing(true);
      const audio = await recordingSession.current?.stop();
      recordingSession.current = undefined;
      if (audio) {
        const text = await desktop.transcribe(audio.mimeType, audio.base64);
        setQuestion((current) => (current.trim() ? `${current.trim()} ${text}` : text));
      }
    } catch (value) {
      recordingSession.current?.cancel();
      recordingSession.current = undefined;
      setRecording(false);
      setError(commandErrorMessage(value));
    } finally {
      setTranscribing(false);
    }
  };

  const generate = async () => {
    if (!context || !settings || !provider?.configured || !question.trim()) return;
    const request = buildLessonRequest(context, settings, provider, question, {
      copiedText,
      sourceUrl,
      nearby,
      activeWindow,
      research,
      imageAids,
    });
    setGenerating(true);
    setError(undefined);
    try {
      const plan = validateLessonPlan(await desktop.generateLesson(request));
      await desktop.presentLesson({ plan, request });
      setQuestion("");
      setCopiedText("");
      setSourceUrl("");
      setContext(undefined);
      setExpanded(false);
      setOptionsOpen(false);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setGenerating(false);
    }
  };

  const openSettings = async () => {
    setMenuOpen(false);
    setOptionsOpen(false);
    setExpanded(false);
    if (isTauriRuntime()) await desktop.showMain("settings");
  };

  const toggleMute = async () => {
    if (!settings || !isTauriRuntime()) return;
    try {
      applyBootstrap(
        await desktop.saveSettings({ ...settings, voiceEnabled: !settings.voiceEnabled }),
      );
    } catch (value) {
      setError(commandErrorMessage(value));
    }
  };

  const closePanel = () => {
    recordingSession.current?.cancel();
    recordingSession.current = undefined;
    setRecording(false);
    setExpanded(false);
    setOptionsOpen(false);
    setError(undefined);
  };

  const hideLauncherControls = () => {
    if (!menuOpen) setLauncherHovered(false);
  };

  if (expanded && context) {
    return (
      <main
        className="pet-view pet-view-expanded"
        style={{ "--pet-scale": settings?.petScale ?? 1 } as React.CSSProperties}
      >
        <section className="pet-ask-card" aria-label="Ask ShowME about the selected screen area">
          <header className="pet-ask-header" data-tauri-drag-region>
            <div className="pet-panel-avatar" data-tauri-drag-region>
              <BrandGlyph />
            </div>
            <div data-tauri-drag-region>
              <strong>{launcherLabel}</strong>
              <span>
                {generating
                  ? "Building your lesson…"
                  : recording
                    ? "Listening… select Stop when done"
                    : "Ready to ask"}
              </span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close question panel"
              disabled={generating}
            >
              <X size={17} />
            </button>
          </header>

          <div className="pet-selection-row">
            <img src={context.previewDataUrl} alt="Selected screen area" />
            <div>
              <strong>
                {context.pixelWidth} × {context.pixelHeight} selection
              </strong>
              <span>Only this approved capture is sent.</span>
            </div>
            <button
              type="button"
              onClick={startCapture}
              aria-label="Capture a different area"
              disabled={generating}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="pet-question-shell">
            <textarea
              ref={inputRef}
              value={question}
              maxLength={4000}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="What do you want to understand?"
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void generate();
                }
              }}
              disabled={generating}
            />
            <div className="pet-question-actions">
              <button
                type="button"
                className={recording ? "recording" : ""}
                onClick={toggleRecording}
                disabled={transcribing || generating || !isTauriRuntime()}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
                {recording ? "Stop" : transcribing ? "Transcribing…" : "Speak"}
              </button>
              <button
                type="button"
                onClick={() => setOptionsOpen((open) => !open)}
                aria-expanded={optionsOpen}
              >
                <SlidersHorizontal size={17} /> Context
              </button>
            </div>
          </div>

          {optionsOpen && (
            <section className="pet-request-options" aria-labelledby="pet-context-title">
              <div className="pet-options-heading">
                <strong id="pet-context-title">Extra context</strong>
                <button
                  type="button"
                  onClick={() => setOptionsOpen(false)}
                  aria-label="Close context options"
                >
                  <X size={14} />
                </button>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={nearby}
                  onChange={(event) => setNearby(event.target.checked)}
                  disabled={!provider?.capabilities.vision}
                />{" "}
                Nearby screen
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={activeWindow}
                  onChange={(event) => setActiveWindow(event.target.checked)}
                  disabled={!provider?.capabilities.vision}
                />{" "}
                Active window
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={research}
                  onChange={(event) => setResearch(event.target.checked)}
                  disabled={!provider?.capabilities.webSearch}
                />{" "}
                Web sources
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={imageAids}
                  onChange={(event) => setImageAids(event.target.checked)}
                />{" "}
                Image aids
              </label>
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="Optional source URL"
                type="url"
              />
              <textarea
                value={copiedText}
                onChange={(event) => setCopiedText(event.target.value)}
                placeholder="Optional copied text"
                maxLength={50000}
              />
            </section>
          )}

          {error && (
            <div className="pet-inline-error" role="alert">
              {error}
            </div>
          )}
          {!provider?.configured && (
            <div className="pet-provider-warning">
              <span>
                <strong>{provider?.name ?? "Provider"} needs an API key.</strong> Add it once in
                Settings.
              </span>
              <button type="button" onClick={openSettings}>
                Open Settings
              </button>
            </div>
          )}
          <footer className="pet-ask-footer">
            <span>{provider ? `${provider.name} · ${provider.model}` : "Loading provider…"}</span>
            <button
              type="button"
              className="pet-send"
              onClick={generate}
              disabled={!question.trim() || generating || !provider?.configured}
            >
              {generating ? (
                <>
                  <span className="pet-button-spinner" /> Building…
                </>
              ) : (
                <>
                  <Send size={17} /> Create lesson
                </>
              )}
            </button>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`pet-view pet-view-collapsed ${launcherRevealed ? "pet-view-ready" : "pet-view-peek"}`}
      style={{ "--pet-scale": settings?.petScale ?? 1 } as React.CSSProperties}
      data-tauri-drag-region
      onPointerEnter={() => setLauncherHovered(true)}
      onPointerLeave={hideLauncherControls}
    >
      {!launcherRevealed ? (
        <button
          className="pet-peek"
          type="button"
          aria-label="Show ShowME controls"
          title="ShowME"
          onFocus={() => setLauncherHovered(true)}
        >
          <span aria-hidden="true">
            <BrandGlyph />
          </span>
        </button>
      ) : (
        <>
          {error && <div className="pet-error">{error}</div>}
          {capturing && <div className="pet-bubble visible">Drag around your focus area</div>}
          <div className="pet-launcher" data-tauri-drag-region>
            <button
              className="pet-character"
              type="button"
              onClick={startCapture}
              disabled={capturing}
              aria-label={`${launcherLabel}: select part of the screen`}
              data-tauri-drag-region
            >
              <span className="pet-launcher-mark" aria-hidden="true">
                <BrandGlyph />
              </span>
              <span className="pet-launcher-copy">
                <strong>{launcherLabel}</strong>
                <small>{capturing ? "Selecting…" : "Select from screen"}</small>
              </span>
              <span className="pet-launcher-action" aria-hidden="true">
                <Crosshair size={18} />
              </span>
            </button>
            <div className="pet-quick-actions">
              {context && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  aria-label="Ask about the current selection by voice or text"
                  title="Ask by voice or text"
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                className="pet-menu-button"
                type="button"
                aria-label="ShowME menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        </>
      )}
      {launcherRevealed && menuOpen && (
        <div className="pet-menu">
          <button type="button" onClick={toggleMute}>
            {settings?.voiceEnabled ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {settings?.voiceEnabled ? "Mute voice" : "Unmute voice"}
          </button>
          <button type="button" onClick={openSettings}>
            <Settings size={15} /> Settings & API keys
          </button>
          <button type="button" onClick={() => desktop.windowAction("hide")}>
            <EyeOff size={15} /> Hide launcher
          </button>
        </div>
      )}
    </main>
  );
}
