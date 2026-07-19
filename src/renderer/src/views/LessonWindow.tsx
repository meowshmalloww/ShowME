import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Gauge,
  Image as ImageIcon,
  Layers3,
  MessageCircleQuestion,
  Minimize2,
  Pause,
  Play,
  SearchCheck,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdaptationKind,
  AppBootstrap,
  ImageAsset,
  LessonPresentation,
  LessonProgress,
  LessonSurface,
} from "../../../shared/types";
import { routeAudioOutput } from "../audio";
import { LessonCanvas } from "../components/LessonCanvas";
import { errorMessage, Spinner, Toast } from "../components/Ui";
import { WindowChrome } from "../components/WindowChrome";

const adaptations: { id: AdaptationKind; label: string }[] = [
  { id: "simpler", label: "Simpler" },
  { id: "deeper", label: "Go deeper" },
  { id: "show-math", label: "Show the math" },
  { id: "another-example", label: "Another example" },
  { id: "let-me-control", label: "Let me control it" },
];

export function LessonWindow() {
  const [presentation, setPresentation] = useState<LessonPresentation | null>(null);
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [mediaAssets, setMediaAssets] = useState<ImageAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [needsRecapture, setNeedsRecapture] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info";
  } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopNarration = useCallback((): void => {
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    audio.current = null;
    setSpeaking(false);
    void window.showme.voice.activity("idle");
  }, []);

  useEffect(() => {
    void window.showme.app.bootstrap().then(setBootstrap);
    const cleanups = [
      window.showme.events.onLessonReady((value) => {
        stopNarration();
        setPresentation(value);
        setStep(0);
        setPlaying(false);
        setAdapting(false);
        setProgress(null);
        setFeedback(null);
        setNeedsRecapture(false);
      }),
      window.showme.events.onLessonProgress((value) => {
        setProgress(value);
        setAdapting(true);
      }),
      window.showme.events.onSettingsChanged((settings) =>
        setBootstrap((current) => (current ? { ...current, settings } : current)),
      ),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
      stopNarration();
    };
  }, [stopNarration]);

  useEffect(() => {
    if (!bootstrap) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      const resolved =
        bootstrap.settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : bootstrap.settings.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("reduced-motion", bootstrap.settings.reducedMotion);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [bootstrap]);

  useEffect(() => {
    let cancelled = false;
    if (!presentation?.request.allowImageAids) {
      setMediaAssets([]);
      setMediaError("");
      setMediaLoading(false);
      return;
    }
    setMediaLoading(true);
    setMediaError("");
    const query = [presentation.plan.concept, presentation.plan.title].join(" ");
    void window.showme.media
      .search(query)
      .then((assets) => {
        if (!cancelled) setMediaAssets(assets.slice(0, 3));
      })
      .catch((reason) => {
        if (!cancelled) setMediaError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [presentation?.plan.concept, presentation?.plan.title, presentation?.request.allowImageAids]);

  useEffect(() => {
    if (!playing || !presentation) return;
    const duration = presentation.plan.steps[step]?.durationMs ?? 2400;
    const timer = window.setTimeout(() => {
      if (step >= presentation.plan.steps.length - 1) setPlaying(false);
      else setStep((current) => current + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [playing, presentation, step]);

  const narrate = async (): Promise<void> => {
    if (!presentation || !bootstrap) return;
    if (speaking) {
      stopNarration();
      return;
    }
    const text = presentation.plan.steps[step]?.narration || presentation.plan.narration;
    try {
      if (bootstrap.settings.voiceOutputProvider === "system") {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = bootstrap.settings.language;
        utterance.rate = bootstrap.settings.speechRate;
        utterance.onend = () => {
          setSpeaking(false);
          void window.showme.voice.activity("idle");
        };
        utterance.onerror = () => {
          setSpeaking(false);
          void window.showme.voice.activity("idle");
        };
        setSpeaking(true);
        await window.showme.voice.activity("speaking");
        window.speechSynthesis.speak(utterance);
      } else {
        const generated = await window.showme.voice.synthesize(text);
        const bytes = new Uint8Array(generated.bytes);
        const url = URL.createObjectURL(new Blob([bytes.buffer], { type: generated.mimeType }));
        const next = new Audio(url);
        await routeAudioOutput(next, bootstrap.settings.speakerDeviceId);
        audio.current = next;
        next.onended = () => {
          URL.revokeObjectURL(url);
          setSpeaking(false);
          void window.showme.voice.activity("idle");
        };
        next.onerror = () => {
          URL.revokeObjectURL(url);
          setSpeaking(false);
          void window.showme.voice.activity("idle");
        };
        setSpeaking(true);
        await window.showme.voice.activity("speaking");
        await next.play();
      }
    } catch (reason) {
      setSpeaking(false);
      await window.showme.voice.activity("idle");
      setToast({ message: errorMessage(reason), tone: "error" });
    }
  };

  const adapt = async (adaptation: AdaptationKind, question?: string): Promise<void> => {
    if (!presentation || adapting) return;
    setAdapting(true);
    setAskOpen(false);
    try {
      const result = await window.showme.lesson.adapt({
        presentation,
        adaptation,
        ...(question ? { question } : {}),
      });
      setPresentation(result.presentation);
      setStep(0);
      setFollowUp("");
    } catch (reason) {
      if (commandCode(reason) === "CAPTURE_EXPIRED") setNeedsRecapture(true);
      setToast({ message: errorMessage(reason), tone: "error" });
    } finally {
      setAdapting(false);
      setProgress(null);
    }
  };

  const setSurface = async (surface: LessonSurface): Promise<void> => {
    if (!presentation) return;
    setPresentation({ ...presentation, surface });
    await window.showme.lesson.setSurface(surface);
  };

  if (!presentation) {
    return (
      <main className="lesson-empty">
        <div className="brand-orb">
          <Sparkles size={24} />
        </div>
        <Spinner />
        <strong>Waiting for a lesson</strong>
        <small>Select something with the top-edge ShowME island.</small>
      </main>
    );
  }

  const { plan } = presentation;
  const currentStep = plan.steps[step] ?? plan.steps[0];
  const reducedMotion = bootstrap?.settings.reducedMotion ?? false;
  return (
    <div className={"lesson-window surface-" + presentation.surface}>
      <WindowChrome title={plan.title} eyebrow={plan.concept} />
      <header className="lesson-header">
        <div className="lesson-title-block">
          <div className="lesson-kicker">
            <ConfidenceBadge value={plan.confidence} />{" "}
            <span>{teachingModeLabel(plan.teachingMode)}</span>
          </div>
          <h1>{plan.title}</h1>
          <p>{plan.summary}</p>
        </div>
        <div className="surface-picker">
          <button
            className={presentation.surface === "inline" ? "active" : ""}
            aria-label="Compact lesson"
            onClick={() => setSurface("inline")}
            type="button"
          >
            <Minimize2 size={15} />
          </button>
          <button
            className={presentation.surface === "side" ? "active" : ""}
            aria-label="Side lesson"
            onClick={() => setSurface("side")}
            type="button"
          >
            <Layers3 size={15} />
          </button>
          <button
            className={presentation.surface === "focus" ? "active" : ""}
            aria-label="Focus lesson"
            onClick={() => setSurface("focus")}
            type="button"
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </header>
      {needsRecapture ? (
        <section className="recapture-banner">
          <span>
            <strong>The private screen snapshot expired.</strong>
            <small>
              Select the source again to ask another visual question; ShowME does not retain
              screenshots in history.
            </small>
          </span>
          <button
            onClick={async () => {
              try {
                await window.showme.lesson.close();
                await window.showme.capture.begin();
              } catch (reason) {
                setToast({ message: errorMessage(reason), tone: "error" });
              }
            }}
            type="button"
          >
            Select source again
          </button>
        </section>
      ) : null}
      <main className="lesson-body">
        <section className="visual-stage">
          <LessonCanvas plan={plan} stepIndex={step} reducedMotion={reducedMotion} />
          <div className="stage-status">
            <span>{plan.simulation ? "Interactive module" : "Visual explanation"}</span>
            {presentation.verification.engine !== "none" ? (
              <span className={presentation.verification.verified ? "verified" : "unverified"}>
                <CheckCircle2 size={13} />{" "}
                {presentation.verification.verified ? "parameters checked" : "check incomplete"}
              </span>
            ) : null}
          </div>
        </section>
        {presentation.request.allowImageAids ? (
          <section className="media-aids-section">
            <div className="media-aids-heading">
              <span>
                <ImageIcon size={16} />
                <span>
                  <strong>Licensed visual references</strong>
                  <small>
                    Optional aids from Wikimedia Commons. Open a card for its source and license.
                  </small>
                </span>
              </span>
              {mediaLoading ? <Spinner small /> : null}
            </div>
            {mediaAssets.length ? (
              <div className="media-aid-grid">
                {mediaAssets.map((asset) => (
                  <button
                    aria-label={"Open source for " + asset.title}
                    key={asset.id}
                    onClick={() => window.showme.app.openExternal(asset.pageUrl)}
                    type="button"
                  >
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt={asset.description || asset.title} />
                    ) : (
                      <span className="media-placeholder">
                        <ImageIcon size={18} />
                      </span>
                    )}
                    <span>
                      <strong>{asset.title}</strong>
                      <small>
                        {asset.artist} · {asset.license}
                      </small>
                    </span>
                    <ExternalLink size={13} />
                  </button>
                ))}
              </div>
            ) : mediaError ? (
              <p className="media-aids-empty">
                Licensed references are unavailable right now. {mediaError}
              </p>
            ) : !mediaLoading ? (
              <p className="media-aids-empty">No clearly licensed reference matched this lesson.</p>
            ) : null}
          </section>
        ) : null}
        <section className="lesson-story">
          <div className="step-progress">
            {plan.steps.map((item, index) => (
              <button
                className={index === step ? "active" : index < step ? "complete" : ""}
                aria-label={"Step " + (index + 1) + ": " + item.title}
                key={item.id}
                onClick={() => {
                  setStep(index);
                  setPlaying(false);
                }}
                type="button"
              >
                <span />
              </button>
            ))}
          </div>
          <div className="step-copy">
            <p className="eyebrow">
              Step {step + 1} of {plan.steps.length}
            </p>
            <h2>{currentStep?.title}</h2>
            <p>{currentStep?.narration}</p>
            {currentStep?.checkpoint ? (
              <div className="checkpoint">
                <CircleHelp size={17} />
                <span>{currentStep.checkpoint}</span>
              </div>
            ) : null}
          </div>
          <div className="playback-controls">
            <button
              aria-label="Previous step"
              disabled={step === 0}
              onClick={() => {
                setStep((value) => Math.max(0, value - 1));
                setPlaying(false);
              }}
              type="button"
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="play-toggle"
              onClick={() => setPlaying((value) => !value)}
              type="button"
            >
              {playing ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
              {playing ? "Pause" : "Play story"}
            </button>
            <button
              aria-label="Next step"
              disabled={step === plan.steps.length - 1}
              onClick={() => {
                setStep((value) => Math.min(plan.steps.length - 1, value + 1));
                setPlaying(false);
              }}
              type="button"
            >
              <ArrowRight size={17} />
            </button>
            <button
              className={speaking ? "speaking" : ""}
              aria-label={speaking ? "Stop narration" : "Narrate this step"}
              onClick={narrate}
              type="button"
            >
              {speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          </div>
          {bootstrap?.settings.captionsEnabled ? (
            <div className="caption-line">
              <Volume2 size={13} />
              <span>{currentStep?.narration}</span>
              {bootstrap.settings.voiceOutputProvider === "openai" ? <em>AI voice</em> : null}
            </div>
          ) : null}
        </section>
        <section className="adapt-section">
          <div className="section-title compact">
            <div>
              <p className="eyebrow">Make it yours</p>
              <h2>Change the explanation</h2>
            </div>
          </div>
          <div className="adapt-pills">
            {adaptations.map((item) => (
              <button
                disabled={adapting}
                key={item.id}
                onClick={() => adapt(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
            <button disabled={adapting} onClick={() => setAskOpen(true)} type="button">
              <MessageCircleQuestion size={14} /> Ask
            </button>
          </div>
          {askOpen ? (
            <form
              className="followup-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (followUp.trim()) void adapt("question", followUp.trim());
              }}
            >
              <input
                placeholder="What still feels unclear?"
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
              />
              <button disabled={!followUp.trim()} type="submit">
                <Send size={15} />
              </button>
              <button aria-label="Close" onClick={() => setAskOpen(false)} type="button">
                <X size={15} />
              </button>
            </form>
          ) : null}
          {plan.followUps.length ? (
            <div className="suggested-questions">
              {plan.followUps.slice(0, 3).map((question) => (
                <button
                  disabled={adapting}
                  key={question}
                  onClick={() => adapt("question", question)}
                  type="button"
                >
                  {question}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <section className="evidence-section">
          <button
            className="evidence-toggle"
            onClick={() => setSourcesOpen((value) => !value)}
            type="button"
          >
            <span>
              {plan.citations.length ? <SearchCheck size={17} /> : <Gauge size={17} />}
              <span>
                <strong>
                  {plan.citations.length
                    ? plan.citations.length + " cited sources"
                    : "Evidence & confidence"}
                </strong>
                <small>{presentation.verification.summary}</small>
              </span>
            </span>
            <ChevronDown className={sourcesOpen ? "rotated" : ""} size={17} />
          </button>
          {sourcesOpen ? (
            <div className="source-list">
              {plan.uncertainty ? (
                <p className="uncertainty-note">
                  <CircleHelp size={15} />
                  {plan.uncertainty}
                </p>
              ) : null}
              {plan.citations.map((citation, index) => (
                <button
                  key={citation.id}
                  onClick={() => window.showme.app.openExternal(citation.url)}
                  type="button"
                >
                  <span>{index + 1}</span>
                  <span>
                    <strong>{citation.title}</strong>
                    <small>{citation.source}</small>
                  </span>
                  <ExternalLink size={14} />
                </button>
              ))}
              {plan.citations.length === 0 ? (
                <p>
                  No external sources were attached. Claims are based on selected evidence,
                  calculation, or clearly labeled model inference.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
        <footer className="lesson-footer">
          <span>Was this useful?</span>
          <button
            className={feedback === true ? "active" : ""}
            aria-label="Helpful"
            onClick={async () => {
              setFeedback(true);
              await window.showme.memory.feedback(plan.id, true);
            }}
            type="button"
          >
            <ThumbsUp size={15} />
          </button>
          <button
            className={feedback === false ? "active" : ""}
            aria-label="Not helpful"
            onClick={async () => {
              setFeedback(false);
              await window.showme.memory.feedback(plan.id, false);
            }}
            type="button"
          >
            <ThumbsDown size={15} />
          </button>
          <span className="lesson-provider">
            {plan.provider.id} · {plan.provider.model}
          </span>
        </footer>
      </main>
      {adapting ? (
        <div className="adapt-overlay">
          <div className="thinking-orb">
            <Sparkles size={20} />
          </div>
          <strong>{progress?.message ?? "Rebuilding the lesson"}</strong>
          <small>Your original lesson stays saved</small>
          <Spinner />
        </div>
      ) : null}
      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function commandCode(reason: unknown): string {
  if (typeof reason !== "object" || reason === null || !("code" in reason)) return "";
  return typeof reason.code === "string" ? reason.code : "";
}

function teachingModeLabel(mode: LessonPresentation["plan"]["teachingMode"]): string {
  return mode === "code-execution" ? "code trace" : mode.replaceAll("-", " ");
}

function ConfidenceBadge({ value }: { value: LessonPresentation["plan"]["confidence"] }) {
  if (value === "verified-module")
    return (
      <span className="confidence-badge verified">
        <CheckCircle2 size={13} /> Verified module
      </span>
    );
  if (value === "source-grounded")
    return (
      <span className="confidence-badge grounded">
        <BookOpenCheck size={13} /> Source grounded
      </span>
    );
  return (
    <span className="confidence-badge exploratory">
      <Sparkles size={13} /> Exploratory
    </span>
  );
}
