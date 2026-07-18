import { listen } from "@tauri-apps/api/event";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { type MainSection, Sidebar, Spinner, Titlebar } from "./components/Chrome";
import { HomeView } from "./components/HomeView";
import { desktop, isTauriRuntime } from "./lib/api";
import { DEMO_BOOTSTRAP, DEMO_PLAN } from "./lib/demo";
import { commandErrorMessage } from "./lib/errors";
import type {
  AppBootstrap,
  AppSettings,
  CommandError,
  GenerateLessonRequest,
  LessonPlan,
  LessonPresentation,
  LessonReceipt,
  StoredLesson,
} from "./lib/types";

const CaptureOverlay = lazy(() =>
  import("./components/CaptureOverlay").then((module) => ({ default: module.CaptureOverlay })),
);
const HistoryView = lazy(() =>
  import("./components/HistoryView").then((module) => ({ default: module.HistoryView })),
);
const LessonView = lazy(() =>
  import("./components/LessonView").then((module) => ({ default: module.LessonView })),
);
const Onboarding = lazy(() =>
  import("./components/Onboarding").then((module) => ({ default: module.Onboarding })),
);
const PetView = lazy(() =>
  import("./components/PetView").then((module) => ({ default: module.PetView })),
);
const SettingsView = lazy(() =>
  import("./components/SettingsView").then((module) => ({ default: module.SettingsView })),
);

const loadingView = (
  <main className="app-loading">
    <Spinner label="Starting ShowME…" />
  </main>
);

function MainApp() {
  const params = new URLSearchParams(window.location.search);
  const previewMode = params.get("preview");
  const browserPreview = import.meta.env.DEV && (previewMode === "1" || previewMode === "lesson");
  const [bootstrap, setBootstrap] = useState<AppBootstrap>();
  const [section, setSection] = useState<MainSection>(() => {
    const requested = params.get("section");
    return requested === "settings" || requested === "history" ? requested : "learn";
  });
  const [lesson, setLesson] = useState<LessonPlan | undefined>(() =>
    previewMode === "lesson" ? DEMO_PLAN : undefined,
  );
  const [request, setRequest] = useState<GenerateLessonRequest>();
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (browserPreview) {
      setBootstrap(DEMO_BOOTSTRAP);
      return DEMO_BOOTSTRAP;
    }
    if (!isTauriRuntime()) {
      throw new Error("ShowME must run inside its native desktop application.");
    }
    const value = await desktop.bootstrap();
    setBootstrap(value);
    return value;
  }, [browserPreview]);

  useEffect(() => {
    document.body.classList.add("main-root");
    const load = async () => {
      try {
        await refresh();
      } catch (value) {
        setError(commandErrorMessage(value));
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => document.body.classList.remove("main-root");
  }, [refresh]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const unlisteners: (() => void)[] = [];
    Promise.all([
      listen("showme:capture-ready", () => {
        setCapturing(false);
      }),
      listen<LessonPresentation>("showme:lesson-ready", async (event) => {
        setLesson(event.payload.plan);
        setRequest(event.payload.request);
        setCapturing(false);
        setSection("learn");
        await refresh().catch(() => undefined);
      }),
      listen<string>("showme:navigate", (event) => {
        if (
          event.payload === "settings" ||
          event.payload === "history" ||
          event.payload === "learn"
        )
          setSection(event.payload);
      }),
      listen<AppSettings>("showme:settings-changed", (event) =>
        setBootstrap((current) => (current ? { ...current, settings: event.payload } : current)),
      ),
      listen<CommandError>("showme:error", (event) =>
        setError(
          event.payload.remediation
            ? `${event.payload.message} ${event.payload.remediation}`
            : event.payload.message,
        ),
      ),
    ]).then((items) => unlisteners.push(...items));
    return () => {
      for (const unlisten of unlisteners) unlisten();
    };
  }, [refresh]);

  const scrollScope = `${section}:${lesson?.id ?? "no-lesson"}`;

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".desktop-content");
    if (content) {
      content.dataset.scrollScope = scrollScope;
      content.scrollTop = 0;
    }
  }, [scrollScope]);

  const startCapture = async () => {
    setError(undefined);
    setCapturing(true);
    try {
      if (isTauriRuntime()) {
        await desktop.endLessonContext();
        await desktop.beginCapture();
      } else {
        throw new Error("Screen capture is available only in the native desktop app.");
      }
    } catch (value) {
      setError(commandErrorMessage(value));
      setCapturing(false);
    }
  };

  const regenerate = async (complexity: "simpler" | "advanced", followUp?: string) => {
    if (!request)
      throw new Error(
        "This saved lesson has no active screen context. Start a new capture to adapt it.",
      );
    const next: GenerateLessonRequest = {
      ...request,
      complexity,
      question: followUp ?? request.question,
    };
    if (!isTauriRuntime()) throw new Error("Lesson adaptation requires the native desktop app.");
    const [{ validateLessonPlan }, generatedPlan] = await Promise.all([
      import("./lib/schema"),
      desktop.generateLesson(next),
    ]);
    const plan = validateLessonPlan(generatedPlan) as LessonPlan;
    setLesson(plan);
    setRequest(next);
    if (isTauriRuntime()) await refresh().catch(() => undefined);
  };

  const closeLesson = async () => {
    setLesson(undefined);
    setRequest(undefined);
    setSection("learn");
    if (isTauriRuntime()) await desktop.endLessonContext().catch(() => undefined);
  };

  const openRecent = async (receipt: LessonReceipt) => {
    if (!isTauriRuntime()) return undefined;
    try {
      const stored = await desktop.getLesson(receipt.id);
      setLesson(stored.plan);
      setRequest(undefined);
      setSection("learn");
      return stored;
    } catch (value) {
      setError(commandErrorMessage(value));
      return undefined;
    }
  };

  const openStored = (stored: StoredLesson) => {
    setLesson(stored.plan);
    setRequest(undefined);
    setSection("learn");
  };

  if (loading)
    return (
      <main className="app-loading">
        <Spinner label="Starting ShowME…" />
      </main>
    );
  if (!bootstrap)
    return (
      <main className="fatal-state">
        <AlertTriangle size={28} />
        <h1>ShowME couldn’t start</h1>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Retry
        </button>
      </main>
    );
  if (!bootstrap.settings.onboardingComplete)
    return <Onboarding bootstrap={bootstrap} onComplete={setBootstrap} />;

  return (
    <div className={`desktop-shell ${bootstrap.settings.reducedMotion ? "reduce-motion" : ""}`}>
      <Titlebar preview={browserPreview} />
      <Sidebar
        section={section}
        onSection={(next) => {
          setSection(next);
          if (next !== "learn") {
            setLesson(undefined);
          }
        }}
        onNew={() => startCapture()}
      />
      <main className="desktop-content">
        <Suspense
          fallback={
            <div className="view-loading">
              <Spinner label="Opening workspace…" />
            </div>
          }
        >
          {section === "settings" ? (
            <SettingsView bootstrap={bootstrap} onSaved={setBootstrap} />
          ) : section === "history" ? (
            <HistoryView
              lessons={bootstrap.recentLessons}
              onOpen={openStored}
              onNew={() => startCapture()}
              onDeleted={(id) =>
                setBootstrap((current) =>
                  current
                    ? {
                        ...current,
                        recentLessons: current.recentLessons.filter((item) => item.id !== id),
                      }
                    : current,
                )
              }
            />
          ) : lesson ? (
            <LessonView
              plan={lesson}
              settings={bootstrap.settings}
              request={request}
              onRegenerate={regenerate}
              onClose={closeLesson}
            />
          ) : (
            <HomeView
              bootstrap={bootstrap}
              onNew={startCapture}
              onSettings={() => setSection("settings")}
              onOpenRecent={openRecent}
            />
          )}
        </Suspense>
      </main>
      {capturing && (
        <div className="capture-launching">
          <Spinner label="Taking one invocation-only snapshot…" />
        </div>
      )}
      {error && (
        <div className="global-toast" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(undefined)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get("view") ?? "main";
  return (
    <Suspense fallback={loadingView}>
      {view === "pet" ? <PetView /> : view === "selection" ? <CaptureOverlay /> : <MainApp />}
    </Suspense>
  );
}
