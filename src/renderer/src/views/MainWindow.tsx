import {
  Archive,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudCog,
  Command,
  Download,
  Eye,
  Gauge,
  GraduationCap,
  HardDrive,
  Home,
  KeyRound,
  LockKeyhole,
  Mic2,
  MonitorUp,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HOTKEYS,
  LANGUAGES,
  TEACHING_STYLE_LABELS,
  VOICE_HOTKEYS,
  VOICES,
} from "../../../shared/defaults";
import type {
  AppBootstrap,
  AppSettings,
  LessonReceipt,
  PermissionStatus,
  ProviderCapabilities,
  ProviderId,
  ProviderSummary,
  WakeListenerStatus,
} from "../../../shared/types";
import {
  type AudioDeviceOption,
  enumerateAudioDevices,
  openConfiguredMicrophone,
  rmsLevel,
} from "../audio";
import { BrandMark } from "../components/BrandMark";
import { ProviderIcon } from "../components/ProviderIcon";
import { EmptyState, errorMessage, Spinner, Toast, Toggle } from "../components/Ui";
import { WindowChrome } from "../components/WindowChrome";

type Section = "home" | "library" | "settings";
type SettingsPage = "models" | "teaching" | "voice" | "privacy" | "appearance" | "about";
const CAPABILITY_KEYS = [
  "vision",
  "structuredOutput",
  "webSearch",
  "speechToText",
  "textToSpeech",
  "streaming",
  "tools",
] as const satisfies readonly (keyof ProviderCapabilities)[];

export function MainWindow() {
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("models");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const wakeStatusRef = useRef<WakeListenerStatus | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const notify = useCallback(
    (message: string, tone: "error" | "success" | "info"): void => setToast({ message, tone }),
    [],
  );

  const refresh = useCallback(async (): Promise<AppBootstrap> => {
    const value = await window.showme.app.bootstrap();
    const current = wakeStatusRef.current
      ? { ...value, wakeListener: wakeStatusRef.current }
      : value;
    setBootstrap(current);
    setDraft(value.settings);
    return current;
  }, []);

  useEffect(() => {
    void refresh().catch((reason) => setToast({ message: errorMessage(reason), tone: "error" }));
    const cleanups = [
      window.showme.events.onNavigate((value) => {
        if (["home", "library", "settings"].includes(value)) setSection(value as Section);
      }),
      window.showme.events.onSettingsChanged((settings) => setDraft(settings)),
      window.showme.events.onWakeStatus((wakeListener) => {
        wakeStatusRef.current = wakeListener;
        setBootstrap((current) => (current ? { ...current, wakeListener } : current));
      }),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [refresh]);

  useEffect(() => {
    if (!draft) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      const resolved = draft.theme === "system" ? (media.matches ? "dark" : "light") : draft.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("reduced-motion", draft.reducedMotion);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [draft]);

  if (!bootstrap || !draft) {
    return (
      <main className="app-loading">
        <div className="brand-orb">
          <BrandMark size={28} />
        </div>
        <Spinner />
        <span>Opening your learning space</span>
      </main>
    );
  }

  if (!bootstrap.settings.onboardingComplete) {
    return (
      <>
        <WindowChrome title="ShowME" />
        <Onboarding
          bootstrap={bootstrap}
          draft={draft}
          setDraft={setDraft}
          onComplete={async (key, provider) => {
            try {
              if (key.trim()) await window.showme.providers.saveKey(provider, key);
              const next = { ...draft, provider, onboardingComplete: true };
              const value = await window.showme.settings.save(next);
              setBootstrap(value);
              setDraft(value.settings);
              setToast({
                message: "ShowME is ready. Your screen stays untouched until you ask.",
                tone: "success",
              });
            } catch (reason) {
              setToast({ message: errorMessage(reason), tone: "error" });
            }
          }}
        />
        {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
      </>
    );
  }

  return (
    <div className={"main-window" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <WindowChrome title="ShowME" />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-orb small">
            <BrandMark size={23} />
          </span>
          <span>
            <strong>ShowME</strong>
            <small>Visual lessons</small>
          </span>
          <button
            className="sidebar-collapse"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav>
          <NavButton
            active={section === "home"}
            icon={<Home />}
            label="Home"
            onClick={() => setSection("home")}
          />
          <NavButton
            active={section === "library"}
            icon={<Archive />}
            label="Library"
            onClick={() => setSection("library")}
          />
          <NavButton
            active={section === "settings"}
            icon={<Settings />}
            label="Settings"
            onClick={() => setSection("settings")}
          />
        </nav>
      </aside>
      <div className="main-content">
        {section === "home" ? (
          <HomeView
            bootstrap={bootstrap}
            onOpen={(id) => void openLesson(id, setToast)}
            onCapture={async () => {
              await window.showme.app.hideWindow();
              await window.showme.capture.begin();
            }}
            onSettings={() => setSection("settings")}
          />
        ) : null}
        {section === "library" ? (
          <LibraryView
            initial={bootstrap.recentLessons}
            onOpen={(id) => void openLesson(id, setToast)}
            onChanged={() => void refresh()}
          />
        ) : null}
        {section === "settings" ? (
          <SettingsView
            bootstrap={bootstrap}
            draft={draft}
            page={settingsPage}
            setPage={setSettingsPage}
            setDraft={setDraft}
            onSaved={async () => {
              try {
                const value = await window.showme.settings.save(draft);
                setBootstrap(value);
                setDraft(value.settings);
                setToast({ message: "Settings saved", tone: "success" });
              } catch (reason) {
                setToast({ message: errorMessage(reason), tone: "error" });
              }
            }}
            onRefresh={refresh}
            notify={notify}
          />
        ) : null}
      </div>
      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function Onboarding({
  bootstrap,
  draft,
  setDraft,
  onComplete,
}: {
  bootstrap: AppBootstrap;
  draft: AppSettings;
  setDraft: (value: AppSettings) => void;
  onComplete: (key: string, provider: ProviderId) => Promise<void>;
}) {
  const [provider, setProvider] = useState<ProviderId>(draft.provider);
  const [key, setKey] = useState("");
  const [working, setWorking] = useState(false);
  const selectedProvider = bootstrap.providers.find((item) => item.id === provider);
  const configured = selectedProvider?.configured ?? false;

  const complete = async (savedKey: string): Promise<void> => {
    setWorking(true);
    try {
      await onComplete(savedKey, provider);
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="onboarding-shell onboarding-redesign">
      <header className="onboarding-topbar">
        <div className="welcome-mark">
          <span className="brand-orb small">
            <BrandMark size={22} />
          </span>
          <span>
            <strong>ShowME</strong>
            <small>Visual learning for anything on screen</small>
          </span>
        </div>
        <span className="setup-estimate">One-minute setup</span>
      </header>

      <div className="onboarding-workspace">
        <section className="onboarding-copy">
          <p className="eyebrow">How ShowME works</p>
          <h1>Understand what’s in front of you.</h1>
          <p className="hero-copy">
            Choose something visible and ask a question. ShowME builds the explanation around your
            exact screen context.
          </p>
          <div className="onboarding-flow">
            <div>
              <span>01</span>
              <Eye size={17} />
              <p>
                <strong>Select</strong>
                <small>An area, a point, or the whole screen</small>
              </p>
            </div>
            <div>
              <span>02</span>
              <BrainCircuit size={17} />
              <p>
                <strong>Ask</strong>
                <small>Use text or speak naturally</small>
              </p>
            </div>
            <div>
              <span>03</span>
              <Play size={17} />
              <p>
                <strong>Learn</strong>
                <small>Explore a visual, interactive explanation</small>
              </p>
            </div>
          </div>
          <div className="onboarding-trust">
            <span>
              <ShieldCheck size={15} /> Capture starts only when you ask
            </span>
            <span>
              <HardDrive size={15} /> Lesson history stays local
            </span>
          </div>
        </section>

        <section className="onboarding-card">
          <header className="setup-header">
            <div>
              <p className="eyebrow">Model access</p>
              <h2>Connect a provider</h2>
              <small>Bring your own API key. You can change providers later.</small>
            </div>
            {configured ? (
              <span className="connection-state">
                <Check size={13} /> Connected
              </span>
            ) : null}
          </header>

          <p className="field-label">Choose a provider</p>
          <div className="provider-chooser compact">
            {bootstrap.providers.map((item) => (
              <button
                className={provider === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => {
                  setProvider(item.id);
                  setDraft({ ...draft, provider: item.id });
                }}
                type="button"
              >
                <span className="provider-logo">
                  <ProviderIcon provider={item.id} size={17} />
                </span>
                <span>{item.name}</span>
                {provider === item.id ? <Check size={13} /> : null}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="first-key-redesign">
            {selectedProvider?.name} API key
          </label>
          <div className="secret-input">
            <KeyRound size={15} />
            <input
              id="first-key-redesign"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={
                configured ? "Connected — enter a new key to replace it" : "Paste API key"
              }
            />
          </div>
          <div className="setup-note">
            <LockKeyhole size={14} />
            <span>{bootstrap.credentialProtection.description}</span>
          </div>

          <div className="onboarding-actions">
            <button
              className="primary-button wide"
              disabled={working || (!configured && key.trim().length < 8)}
              onClick={() => void complete(key)}
              type="button"
            >
              <span>
                {configured && !key.trim() ? "Continue with this provider" : "Save and continue"}
              </span>
              {working ? <Spinner small /> : <ArrowRight size={16} />}
            </button>
            {!configured && key.trim().length < 8 ? (
              <button
                className="onboarding-skip"
                disabled={working}
                onClick={() => void complete("")}
                type="button"
              >
                Set up later
              </button>
            ) : null}
          </div>
          <small className="setup-footer">
            Only context you explicitly submit is sent to the selected provider.
          </small>
        </section>
      </div>
    </main>
  );
}

function HomeView({
  bootstrap,
  onOpen,
  onCapture,
  onSettings,
}: {
  bootstrap: AppBootstrap;
  onOpen: (id: string) => void;
  onCapture: () => Promise<void>;
  onSettings: () => void;
}) {
  const configured = bootstrap.providers.filter((provider) => provider.configured);
  return (
    <main className="page home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Learning space</p>
          <h1>Make the next thing visible.</h1>
          <p>Select part of your screen and turn it into a visual explanation.</p>
        </div>
        <div className="date-chip">
          <Clock3 size={15} />
          {new Intl.DateTimeFormat(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          }).format(new Date())}
        </div>
      </header>
      <section className="hero-action-card">
        <div className="hero-action-copy">
          <span className="hero-icon">
            <BrandMark size={28} />
          </span>
          <div>
            <p>New explanation</p>
            <h2>Choose something on your screen</h2>
            <small>Select an area, point, or the entire display.</small>
          </div>
        </div>
        <button className="hero-capture-button" onClick={onCapture} type="button">
          Select on screen <ArrowRight size={16} />
        </button>
      </section>
      {configured.length === 0 ? (
        <button className="configuration-banner" onClick={onSettings} type="button">
          <CloudCog size={20} />
          <span>
            <strong>Connect a model before your first lesson</strong>
            <small>ShowME never substitutes fake content when generation is unavailable.</small>
          </span>
          <ChevronRight />
        </button>
      ) : null}
      <section className="stat-grid">
        <Stat
          icon={<BookOpen />}
          label="Lessons built"
          value={bootstrap.memorySummary.lessonCount}
          note="Saved locally"
        />
        <Stat
          icon={<BrainCircuit />}
          label="Ideas revisited"
          value={bootstrap.memorySummary.memoryCount}
          note="Your learning memory"
        />
        <Stat
          icon={<Gauge />}
          label="Current rhythm"
          value={
            bootstrap.memorySummary.currentStreak
              ? bootstrap.memorySummary.currentStreak + "d"
              : "—"
          }
          note={bootstrap.memorySummary.studiedToday ? "Learned today" : "Ready when you are"}
        />
      </section>
      <section className="content-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Saved locally</p>
            <h2>Recent lessons</h2>
          </div>
          {bootstrap.recentLessons.length ? (
            <button onClick={() => window.showme.app.openMain("library")} type="button">
              View library <ArrowRight size={15} />
            </button>
          ) : null}
        </div>
        {bootstrap.recentLessons.length ? (
          <div className="lesson-card-grid">
            {bootstrap.recentLessons.slice(0, 4).map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<GraduationCap />}
            title="Your first lesson starts with a selection"
            body="Use the top-edge island or the button above. Screenshots are not added to history—only the lesson you choose to build."
          />
        )}
      </section>
      {bootstrap.memorySummary.topConcepts.length ? (
        <section className="concept-strip">
          <span>Growing concepts</span>
          {bootstrap.memorySummary.topConcepts.map((item) => (
            <span className="concept-pill" key={item.concept}>
              {item.concept}
              <small>{item.count}</small>
            </span>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function LibraryView({
  initial,
  onOpen,
  onChanged,
}: {
  initial: LessonReceipt[];
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [lessons, setLessons] = useState(initial);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void window.showme.memory
        .listLessons(query)
        .then(setLessons)
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);
  return (
    <main className="page library-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Local learning history</p>
          <h1>Your lesson library</h1>
          <p>Search by question, idea, or lesson title.</p>
        </div>
      </header>
      <div className="library-search">
        <Search size={18} />
        <input
          placeholder="Search your lessons"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {loading ? <Spinner small /> : <span>{lessons.length}</span>}
      </div>
      {lessons.length ? (
        <div className="library-list">
          {lessons.map((lesson) => (
            <article className="library-row" key={lesson.id}>
              <button className="lesson-open-area" onClick={() => onOpen(lesson.id)} type="button">
                <span className="lesson-type-icon">
                  <BookOpen size={19} />
                </span>
                <span>
                  <small>{lesson.concept}</small>
                  <strong>{lesson.title}</strong>
                  <em>{lesson.question}</em>
                </span>
              </button>
              <span className={"confidence-tag " + lesson.confidence}>
                {confidenceLabel(lesson.confidence)}
              </span>
              <time>{relativeDate(lesson.updatedAt)}</time>
              <button
                className="delete-icon"
                aria-label="Delete lesson"
                onClick={async () => {
                  if (!confirm("Delete this lesson from this device?")) return;
                  await window.showme.memory.deleteLesson(lesson.id);
                  setLessons((items) => items.filter((item) => item.id !== lesson.id));
                  onChanged();
                }}
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search />}
          title={query ? "No lesson matches that search" : "No saved lessons yet"}
          body={
            query
              ? "Try a concept or a phrase from your original question."
              : "Lessons you create will appear here, stored locally on this device."
          }
        />
      )}
    </main>
  );
}

function SettingsView({
  bootstrap,
  draft,
  page,
  setPage,
  setDraft,
  onSaved,
  onRefresh,
  notify,
}: {
  bootstrap: AppBootstrap;
  draft: AppSettings;
  page: SettingsPage;
  setPage: (page: SettingsPage) => void;
  setDraft: (settings: AppSettings) => void;
  onSaved: () => Promise<void>;
  onRefresh: () => Promise<AppBootstrap>;
  notify: (message: string, tone: "error" | "success" | "info") => void;
}) {
  const panel = useRef<HTMLElement | null>(null);
  const selectPage = (nextPage: SettingsPage): void => {
    panel.current?.scrollTo({ top: 0 });
    setPage(nextPage);
  };

  return (
    <main className="settings-layout">
      <aside className="settings-nav">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
        </div>
        <SettingsNav
          active={page === "models"}
          icon={<CloudCog />}
          label="Models & API"
          onClick={() => selectPage("models")}
        />
        <SettingsNav
          active={page === "teaching"}
          icon={<GraduationCap />}
          label="Teaching"
          onClick={() => selectPage("teaching")}
        />
        <SettingsNav
          active={page === "voice"}
          icon={<Mic2 />}
          label="Voice & language"
          onClick={() => selectPage("voice")}
        />
        <SettingsNav
          active={page === "privacy"}
          icon={<ShieldCheck />}
          label="Privacy & memory"
          onClick={() => selectPage("privacy")}
        />
        <SettingsNav
          active={page === "appearance"}
          icon={<Palette />}
          label="Appearance"
          onClick={() => selectPage("appearance")}
        />
        <SettingsNav
          active={page === "about"}
          icon={<BrandMark size={18} />}
          label="About"
          onClick={() => selectPage("about")}
        />
      </aside>
      <section className="settings-panel" ref={panel}>
        {page !== "about" ? (
          <div className="settings-topbar">
            <span>Changes stay on this device.</span>
            <button className="primary-button" onClick={onSaved} type="button">
              <Check size={16} /> Save changes
            </button>
          </div>
        ) : null}
        {page === "models" ? (
          <ModelsSettings
            providers={bootstrap.providers}
            credentialProtection={bootstrap.credentialProtection}
            draft={draft}
            setDraft={setDraft}
            onRefresh={onRefresh}
            notify={notify}
          />
        ) : null}
        {page === "teaching" ? <TeachingSettings draft={draft} setDraft={setDraft} /> : null}
        {page === "voice" ? (
          <VoiceSettings
            draft={draft}
            platform={bootstrap.platform}
            wakeListener={bootstrap.wakeListener}
            setDraft={setDraft}
            notify={notify}
          />
        ) : null}
        {page === "privacy" ? (
          <PrivacySettings
            bootstrap={bootstrap}
            draft={draft}
            setDraft={setDraft}
            notify={notify}
          />
        ) : null}
        {page === "appearance" ? <AppearanceSettings draft={draft} setDraft={setDraft} /> : null}
        {page === "about" ? <AboutSettings bootstrap={bootstrap} /> : null}
      </section>
    </main>
  );
}

function ModelsSettings({
  providers,
  credentialProtection,
  draft,
  setDraft,
  onRefresh,
  notify,
}: {
  providers: ProviderSummary[];
  credentialProtection: AppBootstrap["credentialProtection"];
  draft: AppSettings;
  setDraft: (value: AppSettings) => void;
  onRefresh: () => Promise<AppBootstrap>;
  notify: (message: string, tone: "error" | "success" | "info") => void;
}) {
  const [selected, setSelected] = useState<ProviderId>(draft.provider);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "models" | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const provider = providers.find((item) => item.id === selected) ?? providers[0];
  if (!provider) return null;
  const providerOverrides = draft.providerCapabilityOverrides[selected] ?? {};
  const effectiveCapabilities = { ...provider.defaultCapabilities, ...providerOverrides };
  const updateProvider = (id: ProviderId): void => {
    setSelected(id);
    setDraft({ ...draft, provider: id });
    setKey("");
    setModels([]);
  };
  return (
    <>
      <SettingsHeader
        eyebrow="Connection"
        title="AI provider"
        body={
          credentialProtection.available
            ? "Connect one service at a time. " + credentialProtection.description
            : credentialProtection.description
        }
      />
      <section className="setup-step provider-choice-step">
        <span className="setup-step-number">1</span>
        <div>
          <strong>Choose a provider</strong>
          <small>This only changes where lesson requests are sent.</small>
        </div>
        <details className="provider-picker">
          <summary>
            <span className="provider-logo">
              <ProviderIcon provider={provider.id} />
            </span>
            <span>
              <strong>{provider.name}</strong>
              <small>{provider.configured ? "Key saved" : "Setup required"}</small>
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className="provider-menu">
            {providers.map((item) => (
              <button
                className={selected === item.id ? "selected" : ""}
                onClick={(event) => {
                  updateProvider(item.id);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
                key={item.id}
                type="button"
              >
                <span className="provider-logo">
                  <ProviderIcon provider={item.id} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.configured ? "Key saved" : "Not connected"}</small>
                </span>
                {selected === item.id ? <Check size={15} /> : null}
              </button>
            ))}
          </div>
        </details>
      </section>
      <section className="settings-card provider-detail">
        <div className="card-heading">
          <div>
            <span className="provider-logo large">
              <ProviderIcon provider={provider.id} size={26} />
            </span>
            <span>
              <h3>{provider.name}</h3>
              <p>{provider.capabilityNote}</p>
            </span>
          </div>
          <span className={provider.configured ? "connected-pill" : "muted-pill"}>
            {provider.configured ? "Connected" : "Needs key"}
          </span>
        </div>
        <div className="capability-row">
          {Object.entries(effectiveCapabilities)
            .filter(([, value]) => value)
            .map(([name]) => (
              <span key={name}>
                <Check size={13} />
                {humanCapability(name)}
              </span>
            ))}
        </div>
        <details className="capability-overrides">
          <summary>
            <span>
              <strong>Advanced capability overrides</strong>
              <small>Use only when you have verified the exact selected model.</small>
            </span>
            <ChevronDown size={16} />
          </summary>
          <div>
            {CAPABILITY_KEYS.map((capability) => {
              const override = providerOverrides[capability];
              return (
                <label key={capability}>
                  <span>{humanCapability(capability)}</span>
                  <select
                    value={
                      override === undefined ? "default" : override ? "supported" : "unsupported"
                    }
                    onChange={(event) => {
                      const nextForProvider = { ...providerOverrides };
                      if (event.target.value === "default") delete nextForProvider[capability];
                      else nextForProvider[capability] = event.target.value === "supported";
                      const nextOverrides = { ...draft.providerCapabilityOverrides };
                      if (Object.keys(nextForProvider).length)
                        nextOverrides[selected] = nextForProvider;
                      else delete nextOverrides[selected];
                      setDraft({ ...draft, providerCapabilityOverrides: nextOverrides });
                    }}
                  >
                    <option value="default">
                      Provider default ·{" "}
                      {provider.defaultCapabilities[capability] ? "supported" : "unsupported"}
                    </option>
                    <option value="supported">Force supported</option>
                    <option value="unsupported">Force unsupported</option>
                  </select>
                </label>
              );
            })}
          </div>
        </details>
        <div className="setup-section-label model-step-label">
          <span className="setup-step-number">3</span>
          <span>
            <strong>Choose models</strong>
            <small>Fetch the provider list or enter a model ID manually.</small>
          </span>
        </div>
        <div className="two-column-fields">
          <label>
            <span>Vision / lesson model</span>
            <div className="model-input">
              <input
                value={draft.models[selected]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    models: { ...draft.models, [selected]: event.target.value },
                  })
                }
                list="provider-model-list"
              />
              <button
                aria-label="Fetch available models"
                disabled={!provider.configured || busy !== null}
                onClick={async () => {
                  setBusy("models");
                  try {
                    const items = await window.showme.providers.models(selected);
                    setModels(items.map((item) => item.id));
                    notify("Loaded " + items.length + " provider models", "success");
                  } catch (reason) {
                    notify(errorMessage(reason), "error");
                  } finally {
                    setBusy(null);
                  }
                }}
                type="button"
              >
                {busy === "models" ? <Spinner small /> : <RefreshCw size={15} />} Fetch models
              </button>
            </div>
            <datalist id="provider-model-list">
              {models.map((model) => (
                <option value={model} key={model} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Text / planning model</span>
            <input
              value={draft.textModels[selected]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  textModels: { ...draft.textModels, [selected]: event.target.value },
                })
              }
            />
          </label>
        </div>
        <div className="setup-section-label credential-step-label">
          <span className="setup-step-number">2</span>
          <span>
            <strong>Save and verify your key</strong>
            <small>Test the connection before choosing models.</small>
          </span>
        </div>
        <label>
          <span>API key</span>
          <div className="secret-input">
            <KeyRound size={16} />
            <input
              type="password"
              autoComplete="off"
              placeholder={
                provider.configured
                  ? "Encrypted key saved — paste to replace"
                  : "Paste provider key"
              }
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <button
              disabled={key.trim().length < 8 || busy !== null}
              onClick={async () => {
                setBusy("save");
                try {
                  await window.showme.providers.saveKey(selected, key);
                  await window.showme.settings.save(draft);
                  await onRefresh();
                  setKey("");
                  notify("Encrypted " + provider.name + " key saved", "success");
                } catch (reason) {
                  notify(errorMessage(reason), "error");
                } finally {
                  setBusy(null);
                }
              }}
              type="button"
            >
              {busy === "save" ? <Spinner small /> : "Save key"}
            </button>
          </div>
        </label>
        <div className="provider-actions">
          <button
            className="secondary-button"
            disabled={!provider.configured || busy !== null}
            onClick={async () => {
              setBusy("test");
              try {
                notify(
                  await window.showme.providers.test(selected, draft.models[selected]),
                  "success",
                );
              } catch (reason) {
                notify(errorMessage(reason), "error");
              } finally {
                setBusy(null);
              }
            }}
            type="button"
          >
            {busy === "test" ? <Spinner small /> : <Play size={15} />} Test connection
          </button>
          {provider.configured ? (
            <button
              className="danger-text-button"
              onClick={async () => {
                if (!confirm("Remove this provider key from encrypted storage?")) return;
                await window.showme.providers.deleteKey(selected);
                await onRefresh();
                notify("Provider key removed", "info");
              }}
              type="button"
            >
              <Trash2 size={15} /> Remove key
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

function TeachingSettings({
  draft,
  setDraft,
}: {
  draft: AppSettings;
  setDraft: (value: AppSettings) => void;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Learning"
        title="Teaching style"
        body="Set the default shape of a lesson. You can still adapt every lesson afterward."
      />
      <section className="settings-card form-stack">
        <label>
          <span>Default teaching approach</span>
          <select
            value={draft.teachingStyle}
            onChange={(event) =>
              setDraft({
                ...draft,
                teachingStyle: event.target.value as AppSettings["teachingStyle"],
              })
            }
          >
            {Object.entries(TEACHING_STYLE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented-field">
          <span>Default research depth</span>
          <div>
            <button
              className={draft.researchMode === "quick" ? "active" : ""}
              onClick={() => setDraft({ ...draft, researchMode: "quick" })}
              type="button"
            >
              Quick
            </button>
            <button
              className={draft.researchMode === "deep" ? "active" : ""}
              onClick={() => setDraft({ ...draft, researchMode: "deep" })}
              type="button"
            >
              Deep · cited
            </button>
          </div>
        </div>
        <div className="segmented-field">
          <span>Lesson surface</span>
          <div>
            {(["inline", "side", "focus"] as const).map((surface) => (
              <button
                className={draft.lessonSurface === surface ? "active" : ""}
                key={surface}
                onClick={() => setDraft({ ...draft, lessonSurface: surface })}
                type="button"
              >
                {surface}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          checked={draft.imageAidsDefault}
          onChange={(value) => setDraft({ ...draft, imageAidsDefault: value })}
          label="Search for licensed visual aids"
          note="Uses Wikimedia Commons only when a lesson asks for it."
        />
      </section>
    </>
  );
}

function AppearanceSettings({
  draft,
  setDraft,
}: {
  draft: AppSettings;
  setDraft: (value: AppSettings) => void;
}) {
  return (
    <>
      <SettingsHeader
        eyebrow="Interface"
        title="Appearance"
        body="Use the system theme or keep ShowME consistently light or dark."
      />
      <section className="settings-card form-stack">
        <fieldset className="theme-options">
          <legend>Theme</legend>
          {(
            [
              ["system", "System", MonitorUp],
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
            ] as const
          ).map(([theme, label, Icon]) => (
            <button
              className={draft.theme === theme ? "selected" : ""}
              key={theme}
              onClick={() => setDraft({ ...draft, theme })}
              type="button"
            >
              <Icon size={18} />
              <span>{label}</span>
              {draft.theme === theme ? <Check size={15} /> : null}
            </button>
          ))}
        </fieldset>
        <Toggle
          checked={draft.reducedMotion}
          onChange={(value) => setDraft({ ...draft, reducedMotion: value })}
          label="Reduce motion"
          note="Minimizes expansion and page transitions while keeping state changes clear."
        />
      </section>
    </>
  );
}

function VoiceSettings({
  draft,
  platform,
  wakeListener,
  setDraft,
  notify,
}: {
  draft: AppSettings;
  platform: string;
  wakeListener: WakeListenerStatus;
  setDraft: (value: AppSettings) => void;
  notify: (message: string, tone: "error" | "success" | "info") => void;
}) {
  const [devices, setDevices] = useState<{
    inputs: AudioDeviceOption[];
    outputs: AudioDeviceOption[];
  }>({ inputs: [], outputs: [] });
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [testingMicrophone, setTestingMicrophone] = useState(false);
  const [testLevel, setTestLevel] = useState(0);
  const [listenerStatus, setListenerStatus] = useState(wakeListener);
  const testStream = useRef<MediaStream | null>(null);
  const testContext = useRef<AudioContext | null>(null);
  const testFrame = useRef<number | null>(null);

  const stopMicrophoneTest = useCallback((): void => {
    if (testFrame.current !== null) cancelAnimationFrame(testFrame.current);
    testFrame.current = null;
    for (const track of testStream.current?.getTracks() ?? []) track.stop();
    testStream.current = null;
    const context = testContext.current;
    testContext.current = null;
    if (context && context.state !== "closed") void context.close();
    setTestingMicrophone(false);
    setTestLevel(0);
  }, []);

  const refreshDevices = useCallback(
    async (requestAccess = false): Promise<void> => {
      setDeviceLoading(true);
      try {
        setDevices(await enumerateAudioDevices(requestAccess));
      } catch (reason) {
        notify(errorMessage(reason), "error");
      } finally {
        setDeviceLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    void refreshDevices(false);
    const onDevicesChanged = (): void => void refreshDevices(false);
    navigator.mediaDevices?.addEventListener?.("devicechange", onDevicesChanged);
    const unsubscribe = window.showme.events.onWakeStatus(setListenerStatus);
    return () => {
      unsubscribe();
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDevicesChanged);
      stopMicrophoneTest();
    };
  }, [refreshDevices, stopMicrophoneTest]);

  const toggleMicrophoneTest = async (): Promise<void> => {
    if (testingMicrophone) {
      stopMicrophoneTest();
      return;
    }
    try {
      const opened = await openConfiguredMicrophone(draft);
      testStream.current = opened.stream;
      const context = new AudioContext({ latencyHint: "interactive" });
      const source = context.createMediaStreamSource(opened.stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      testContext.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      const measure = (): void => {
        analyser.getByteTimeDomainData(samples);
        setTestLevel(Math.min(1, rmsLevel(samples) * 8.5));
        testFrame.current = requestAnimationFrame(measure);
      };
      setTestingMicrophone(true);
      measure();
      await refreshDevices(false);
      notify(
        opened.fellBackToDefault
          ? "The saved microphone is missing; testing the system default instead."
          : "Microphone test started. Speak and watch the level meter.",
        opened.fellBackToDefault ? "info" : "success",
      );
    } catch (reason) {
      stopMicrophoneTest();
      notify(errorMessage(reason), "error");
    }
  };

  return (
    <>
      <SettingsHeader
        eyebrow="Conversation"
        title="Voice & language"
        body="Say ShowME, ask naturally, and watch the top island follow the conversation."
      />
      <section className="settings-card form-stack">
        <label>
          <span>Assistant name</span>
          <input
            maxLength={32}
            value={draft.assistantName}
            onChange={(event) => setDraft({ ...draft, assistantName: event.target.value })}
          />
          <small>
            Recognizes “{draft.assistantName},” “Hey {draft.assistantName},” “Show me,” and “Okay{" "}
            {draft.assistantName}” locally. No model key is required for wake-up.
          </small>
        </label>
        <Toggle
          checked={draft.wakeEnabled}
          onChange={(value) => setDraft({ ...draft, wakeEnabled: value })}
          label="Listen for the wake phrase"
          note={
            platform === "win32"
              ? "Uses the lightweight Windows speech recognizer locally. Audio is not saved or sent to a provider until the wake phrase is heard."
              : "Wake phrase standby is currently available on Windows. Push-to-talk remains available here."
          }
        />
        <div className={"wake-health wake-health-" + listenerStatus.state}>
          <span className="wake-health-dot" aria-hidden="true" />
          <span>
            <strong>
              {listenerStatus.state === "ready"
                ? "Wake listener ready"
                : listenerStatus.state === "starting"
                  ? "Starting wake listener"
                  : listenerStatus.state === "error"
                    ? "Wake listener needs attention"
                    : "Wake listener off"}
            </strong>
            <small>
              {listenerStatus.message}
              {listenerStatus.culture ? " Recognizer: " + listenerStatus.culture + "." : ""}
            </small>
          </span>
        </div>
        <label>
          <span>Wake sensitivity · {Math.round((1 - draft.wakeSensitivity) * 100)}%</span>
          <input
            className="range-input"
            type="range"
            min="0.25"
            max="0.9"
            step="0.01"
            value={draft.wakeSensitivity}
            onChange={(event) =>
              setDraft({ ...draft, wakeSensitivity: Number(event.target.value) })
            }
          />
          <small>
            Higher percentages wake more easily. Increase the confidence threshold if false wakes
            occur.
          </small>
        </label>
        <Toggle
          checked={draft.voiceEnabled}
          onChange={(value) => setDraft({ ...draft, voiceEnabled: value })}
          label="Voice narration"
          note="Read lesson steps aloud when requested."
        />
        <Toggle
          checked={draft.captionsEnabled}
          onChange={(value) => setDraft({ ...draft, captionsEnabled: value })}
          label="Captions"
          note="Keep narration visible alongside the lesson."
        />
        <label>
          <span>Lesson language</span>
          <select
            value={draft.language}
            onChange={(event) => setDraft({ ...draft, language: event.target.value })}
          >
            {LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Voice input provider</span>
          <select
            value={draft.voiceInputProvider}
            onChange={(event) =>
              setDraft({
                ...draft,
                voiceInputProvider: event.target.value as AppSettings["voiceInputProvider"],
              })
            }
          >
            <option value="openai">OpenAI transcription</option>
            <option value="groq">Groq transcription</option>
          </select>
        </label>
        <label>
          <span>Narration engine</span>
          <select
            value={draft.voiceOutputProvider}
            onChange={(event) =>
              setDraft({
                ...draft,
                voiceOutputProvider: event.target.value as AppSettings["voiceOutputProvider"],
              })
            }
          >
            <option value="system">System voice · local</option>
            <option value="openai">OpenAI speech · cloud</option>
          </select>
        </label>
        {draft.voiceOutputProvider === "openai" ? (
          <label>
            <span>OpenAI voice</span>
            <select
              value={draft.voice}
              onChange={(event) => setDraft({ ...draft, voice: event.target.value })}
            >
              {VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label} — {voice.note}
                </option>
              ))}
            </select>
            <small>AI-generated voice will be identified as such in the lesson player.</small>
          </label>
        ) : null}
        <label>
          <span>Speech rate · {draft.speechRate.toFixed(1)}×</span>
          <input
            className="range-input"
            type="range"
            min="0.6"
            max="1.8"
            step="0.1"
            value={draft.speechRate}
            onChange={(event) => setDraft({ ...draft, speechRate: Number(event.target.value) })}
          />
        </label>
      </section>
      <section className="settings-card form-stack audio-device-card">
        <div className="card-heading">
          <div>
            <span className="setting-icon">
              <Mic2 size={19} />
            </span>
            <span>
              <h3>Audio devices</h3>
              <p>Choose capture and playback hardware, then verify the live input level.</p>
            </span>
          </div>
          <button
            className="secondary-button compact"
            disabled={deviceLoading}
            onClick={() => void refreshDevices(true)}
            type="button"
          >
            <RefreshCw size={15} className={deviceLoading ? "spin" : ""} />
            Refresh
          </button>
        </div>
        <label>
          <span>Microphone for questions</span>
          <select
            value={draft.microphoneDeviceId}
            onChange={(event) => {
              stopMicrophoneTest();
              setDraft({ ...draft, microphoneDeviceId: event.target.value });
            }}
          >
            <option value="default">System default microphone</option>
            {!devices.inputs.some((device) => device.id === draft.microphoneDeviceId) &&
            draft.microphoneDeviceId !== "default" ? (
              <option value={draft.microphoneDeviceId}>Saved microphone (currently missing)</option>
            ) : null}
            {devices.inputs.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
          <small>
            Voice questions use this device. The lightweight Windows wake listener uses the current
            Windows default input.
          </small>
        </label>
        <div className="microphone-test-row">
          <button
            className={"secondary-button" + (testingMicrophone ? " active" : "")}
            onClick={() => void toggleMicrophoneTest()}
            type="button"
          >
            <Mic2 size={16} /> {testingMicrophone ? "Stop microphone test" : "Test microphone"}
          </button>
          <div
            className="microphone-level"
            role="progressbar"
            aria-label="Live microphone level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(testLevel * 100)}
          >
            <span style={{ transform: `scaleX(${Math.max(0.015, testLevel)})` }} />
          </div>
          <small>{testingMicrophone ? Math.round(testLevel * 100) + "%" : "Not testing"}</small>
        </div>
        <label>
          <span>Speaker for cloud narration</span>
          <select
            value={draft.speakerDeviceId}
            onChange={(event) => setDraft({ ...draft, speakerDeviceId: event.target.value })}
          >
            <option value="default">System default speaker</option>
            {!devices.outputs.some((device) => device.id === draft.speakerDeviceId) &&
            draft.speakerDeviceId !== "default" ? (
              <option value={draft.speakerDeviceId}>Saved speaker (currently missing)</option>
            ) : null}
            {devices.outputs.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
          <small>
            OpenAI narration is routed here. Local system narration follows the Windows default
            speaker.
          </small>
        </label>
        <div className="audio-processing-grid">
          <Toggle
            checked={draft.echoCancellation}
            onChange={(value) => setDraft({ ...draft, echoCancellation: value })}
            label="Echo cancellation"
            note="Reduces speaker feedback during voice capture."
          />
          <Toggle
            checked={draft.noiseSuppression}
            onChange={(value) => setDraft({ ...draft, noiseSuppression: value })}
            label="Noise suppression"
            note="Filters steady room and fan noise."
          />
          <Toggle
            checked={draft.autoGainControl}
            onChange={(value) => setDraft({ ...draft, autoGainControl: value })}
            label="Automatic gain"
            note="Balances quiet and loud speech."
          />
        </div>
        <div className="audio-timing-grid">
          <label>
            <span>Finish after silence · {(draft.voiceSilenceMs / 1000).toFixed(1)}s</span>
            <input
              className="range-input"
              type="range"
              min="400"
              max="4000"
              step="100"
              value={draft.voiceSilenceMs}
              onChange={(event) =>
                setDraft({ ...draft, voiceSilenceMs: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Maximum voice question · {draft.voiceMaxSeconds}s</span>
            <input
              className="range-input"
              type="range"
              min="5"
              max="60"
              step="1"
              value={draft.voiceMaxSeconds}
              onChange={(event) =>
                setDraft({ ...draft, voiceMaxSeconds: Number(event.target.value) })
              }
            />
          </label>
        </div>
      </section>
      <section className="settings-card">
        <div className="card-heading">
          <div>
            <span className="setting-icon">
              <Command size={19} />
            </span>
            <span>
              <h3>Shortcuts</h3>
              <p>Global shortcuts work while ShowME is in the tray.</p>
            </span>
          </div>
        </div>
        <label>
          <span>Select something</span>
          <select
            value={draft.hotkey}
            onChange={(event) => setDraft({ ...draft, hotkey: event.target.value })}
          >
            {HOTKEYS.map((hotkey) => (
              <option key={hotkey.id} value={hotkey.id}>
                {hotkey.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Voice-first capture</span>
          <select
            value={draft.voiceHotkey}
            onChange={(event) => setDraft({ ...draft, voiceHotkey: event.target.value })}
          >
            {!VOICE_HOTKEYS.some((hotkey) => hotkey.id === draft.voiceHotkey) ? (
              <option value={draft.voiceHotkey}>{draft.voiceHotkey}</option>
            ) : null}
            {VOICE_HOTKEYS.map((hotkey) => (
              <option key={hotkey.id} value={hotkey.id}>
                {hotkey.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </>
  );
}

function PrivacySettings({
  bootstrap,
  draft,
  setDraft,
  notify,
}: {
  bootstrap: AppBootstrap;
  draft: AppSettings;
  setDraft: (value: AppSettings) => void;
  notify: (message: string, tone: "error" | "success" | "info") => void;
}) {
  const [permissions, setPermissions] = useState<PermissionStatus>(bootstrap.permissions);
  const [checkingMicrophone, setCheckingMicrophone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPermissions(bootstrap.permissions);
    if (bootstrap.platform !== "darwin" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((result) => {
          if (cancelled) return;
          setPermissions((current) => ({
            ...current,
            microphone:
              result.state === "granted"
                ? "granted"
                : result.state === "denied"
                  ? "denied"
                  : "unknown",
          }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [bootstrap.permissions, bootstrap.platform]);

  const requestMicrophone = async (): Promise<void> => {
    setCheckingMicrophone(true);
    try {
      if (bootstrap.platform === "darwin") {
        setPermissions(await window.showme.permissions.requestMicrophone());
      } else {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Microphone access is not available in this desktop session.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) track.stop();
        const next = await window.showme.permissions.status();
        setPermissions({ ...next, microphone: "granted" });
      }
      notify("Microphone access is ready for ShowME voice input", "success");
    } catch (reason) {
      setPermissions((current) => ({ ...current, microphone: "denied" }));
      notify(errorMessage(reason), "error");
    } finally {
      setCheckingMicrophone(false);
    }
  };

  return (
    <>
      <SettingsHeader
        eyebrow="Control"
        title="Privacy & memory"
        body="Capture is invocation-only. Prepared images live in memory; lesson history uses a local SQLite database."
      />
      <section className="privacy-summary">
        <div>
          <ShieldCheck size={21} />
          <span>
            <strong>Screen capture</strong>
            <small>{permissions.capture}</small>
          </span>
        </div>
        <div>
          <Mic2 size={21} />
          <span>
            <strong>Microphone</strong>
            <small>{permissions.microphone}</small>
          </span>
        </div>
        <div>
          <HardDrive size={21} />
          <span>
            <strong>Local lessons</strong>
            <small>{bootstrap.memorySummary.lessonCount}</small>
          </span>
        </div>
      </section>
      <section className="settings-card permission-action">
        <div>
          <strong>API-key protection</strong>
          <small>{bootstrap.credentialProtection.description}</small>
        </div>
        <span
          className={bootstrap.credentialProtection.available ? "connected-pill" : "muted-pill"}
        >
          <LockKeyhole size={14} />
          {bootstrap.credentialProtection.available ? "Protected" : "Unavailable"}
        </span>
      </section>
      <section className="settings-card permission-action">
        <div>
          <strong>Voice microphone</strong>
          <small>
            {draft.wakeEnabled
              ? "The Windows wake listener stays local and recognizes the configured name with Hey or Okay variants. Provider transcription begins only after wake-up."
              : "Checks permission once and releases the microphone immediately. Voice input starts only when you press the microphone button."}
          </small>
        </div>
        <button
          className="secondary-button"
          disabled={checkingMicrophone || permissions.microphone === "unsupported"}
          onClick={() => void requestMicrophone()}
          type="button"
        >
          {checkingMicrophone ? <Spinner small /> : <Mic2 size={15} />}
          {permissions.microphone === "granted" ? "Check again" : "Allow microphone"}
        </button>
      </section>
      <section className="settings-card form-stack">
        <Toggle
          checked={draft.memoryEnabled}
          onChange={(value) => setDraft({ ...draft, memoryEnabled: value })}
          label="Learning memory"
          note="Remember concepts and explicit preferences locally to tailor future lessons."
        />
        <Toggle
          checked={draft.webResearchDefault}
          onChange={(value) => setDraft({ ...draft, webResearchDefault: value })}
          label="Cited web research by default"
          note="Requires a provider with a native web-search capability."
        />
        <Toggle
          checked={draft.nearbyContextDefault}
          onChange={(value) => setDraft({ ...draft, nearbyContextDefault: value })}
          label="Allow nearby screen context"
          note="Off by default. Selection remains the normal boundary."
        />
        <Toggle
          checked={draft.activeWindowDefault}
          onChange={(value) => setDraft({ ...draft, activeWindowDefault: value })}
          label="Include active-window context"
          note="Reserved for native context integrations; screen selection remains explicit."
        />
      </section>
      <section className="settings-card data-actions">
        <div className="card-heading">
          <div>
            <span className="setting-icon">
              <HardDrive size={19} />
            </span>
            <span>
              <h3>Your data</h3>
              <p>Export readable JSON or remove local lesson and memory records.</p>
            </span>
          </div>
        </div>
        <div>
          <button
            className="secondary-button"
            onClick={async () => {
              const path = await window.showme.memory.export();
              if (path) notify("Exported to " + path, "success");
            }}
            type="button"
          >
            <Download size={16} /> Export data
          </button>
          <button
            className="danger-button"
            onClick={async () => {
              if (
                !confirm(
                  "Delete every saved lesson and learning memory on this device? This cannot be undone.",
                )
              )
                return;
              await window.showme.memory.deleteAll();
              notify("Local lesson history and learning memory deleted", "info");
            }}
            type="button"
          >
            <Trash2 size={16} /> Delete all local data
          </button>
        </div>
      </section>
    </>
  );
}

function AboutSettings({ bootstrap }: { bootstrap: AppBootstrap }) {
  return (
    <>
      <SettingsHeader
        eyebrow="ShowME"
        title="Built to demonstrate"
        body="A screen-aware visual lesson compiler—not a chatbot floating over your desktop."
      />
      <section className="about-hero settings-card">
        <span className="brand-orb">
          <BrandMark size={30} />
        </span>
        <div>
          <h2>ShowME {bootstrap.appVersion}</h2>
          <p>
            Electron + TypeScript for the trusted desktop shell, Rust for display geometry, Python
            for deterministic verification.
          </p>
        </div>
      </section>
      <section className="architecture-grid">
        <div>
          <MonitorUp />
          <strong>Explicit capture</strong>
          <small>No polling and no background screenshots.</small>
        </div>
        <div>
          <LockKeyhole />
          <strong>Sandboxed UI</strong>
          <small>No Node, secrets, or provider network access in renderer windows.</small>
        </div>
        <div>
          <BrainCircuit />
          <strong>Validated plans</strong>
          <small>Models choose from a schema; ShowME owns rendering and simulation.</small>
        </div>
        <div>
          <ShieldCheck />
          <strong>Truth states</strong>
          <small>Verified, source-grounded, or clearly exploratory.</small>
        </div>
      </section>
      <section className="settings-card runtime-card">
        <h3>Runtime readiness</h3>
        <p>
          <Check size={15} /> Rust geometry worker{" "}
          {bootstrap.workers.rust ? "ready" : "using equivalent TypeScript fallback"}
        </p>
        <p>
          <Check size={15} /> Python verifier{" "}
          {bootstrap.workers.python ? "ready" : "using deterministic TypeScript fallback"}
        </p>
        <p>License: Apache-2.0 · Source details are available in the installed project README.</p>
        <button
          className="secondary-button"
          onClick={async () => {
            await window.showme.settings.save({
              ...bootstrap.settings,
              onboardingComplete: false,
            });
            window.location.reload();
          }}
          type="button"
        >
          Replay first-run setup
        </button>
      </section>
    </>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}
function SettingsNav({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
      <ChevronRight size={14} />
    </button>
  );
}
function SettingsHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <header className="settings-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </header>
  );
}
function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="stat-card">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{note}</em>
      </div>
    </article>
  );
}
function LessonCard({ lesson, onOpen }: { lesson: LessonReceipt; onOpen: (id: string) => void }) {
  return (
    <button className="lesson-card" onClick={() => onOpen(lesson.id)} type="button">
      <span className="lesson-card-art">
        <BookOpen size={22} />
      </span>
      <span className="lesson-card-body">
        <small>{lesson.concept}</small>
        <strong>{lesson.title}</strong>
        <em>{lesson.question}</em>
        <span>
          <time>{relativeDate(lesson.updatedAt)}</time>
          <span className={"confidence-dot " + lesson.confidence} />
          {confidenceLabel(lesson.confidence)}
        </span>
      </span>
    </button>
  );
}
async function openLesson(
  id: string,
  notify: (value: { message: string; tone: "error" | "success" | "info" } | null) => void,
): Promise<void> {
  try {
    await window.showme.lesson.openSaved(id);
  } catch (reason) {
    notify({ message: errorMessage(reason), tone: "error" });
  }
}
function confidenceLabel(value: LessonReceipt["confidence"]): string {
  return value === "verified-module"
    ? "Verified module"
    : value === "source-grounded"
      ? "Source grounded"
      : "Exploratory";
}
function relativeDate(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const day = 86_400_000;
  if (elapsed < day) return "Today";
  if (elapsed < day * 2) return "Yesterday";
  if (elapsed < day * 7) return Math.floor(elapsed / day) + " days ago";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}
function humanCapability(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
