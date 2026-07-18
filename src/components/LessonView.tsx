import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gauge,
  ImagePlus,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { desktop, isTauriRuntime } from "../lib/api";
import { speakNarration, stopNarration } from "../lib/audio";
import { commandErrorMessage } from "../lib/errors";
import type { AppSettings, GenerateLessonRequest, ImageAsset, LessonPlan } from "../lib/types";
import { Spinner } from "./Chrome";
import { LessonRenderer } from "./LessonRenderer";

function confidenceLabel(confidence: LessonPlan["confidence"]) {
  return {
    "verified-module": "Verified simulation",
    "source-grounded": "Source grounded",
    exploratory: "Exploratory visual",
  }[confidence];
}

function initialControlValues(plan: LessonPlan): Record<string, number> {
  return Object.fromEntries(
    plan.controls.map((item) => {
      const aligned = item.min + Math.round((item.value - item.min) / item.step) * item.step;
      return [item.bind, Math.max(item.min, Math.min(item.max, aligned))];
    }),
  );
}

async function openUrl(url: string) {
  if (isTauriRuntime()) await desktop.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function ImageAids({ plan }: { plan: LessonPlan }) {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const search = async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (isTauriRuntime())
        setAssets(await desktop.searchImages(`${plan.concept} educational diagram`));
      else setAssets([]);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setLoading(false);
    }
  };
  if (assets.length === 0) {
    return (
      <div className="image-aids-empty">
        <div>
          <ImagePlus size={18} />
          <span>
            <strong>Optional image aids</strong>
            <small>Search Wikimedia Commons with license metadata.</small>
          </span>
        </div>
        <button type="button" onClick={search} disabled={loading || !isTauriRuntime()}>
          {loading ? <Spinner label="Searching" /> : "Find images"}
        </button>
        {error && <small className="error-text">{error}</small>}
      </div>
    );
  }
  return (
    <div className="image-aid-grid">
      {assets.map((asset) => (
        <article key={asset.id}>
          <img src={asset.thumbnailUrl} alt={asset.description || asset.title} />
          <div>
            <strong>{asset.title}</strong>
            <small>
              {asset.artist} · {asset.license}
            </small>
            <button type="button" onClick={() => openUrl(asset.pageUrl)}>
              Attribution <ExternalLink size={12} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LessonView({
  plan,
  settings,
  request,
  onRegenerate,
  onClose,
}: {
  plan: LessonPlan;
  settings: AppSettings;
  request?: GenerateLessonRequest;
  onRegenerate: (complexity: "simpler" | "advanced", followUp?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [paused, setPaused] = useState(settings.reducedMotion);
  const [replayKey, setReplayKey] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [adapting, setAdapting] = useState<string>();
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<boolean>();
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const expandedCloseRef = useRef<HTMLButtonElement>(null);
  const narrationRunRef = useRef(0);
  const narrationScopeRef = useRef("");
  const [controlValues, setControlValues] = useState<Record<string, number>>(() =>
    initialControlValues(plan),
  );
  const step = plan.steps[activeStep] ?? plan.steps[0];

  useEffect(() => {
    setActiveStep(0);
    setControlValues(initialControlValues(plan));
    setReplayKey((value) => value + 1);
    setExpanded(false);
  }, [plan]);

  useEffect(() => {
    if (paused || settings.reducedMotion || !step) return;
    const timer = window.setTimeout(() => {
      setActiveStep((current) => {
        if (current >= plan.steps.length - 1) {
          setPaused(true);
          return current;
        }
        return current + 1;
      });
    }, step.durationMs);
    return () => window.clearTimeout(timer);
  }, [paused, plan.steps.length, settings.reducedMotion, step]);

  useEffect(() => () => stopNarration(), []);

  useEffect(() => {
    const scope = `${plan.id}:${step?.id ?? activeStep}`;
    if (narrationScopeRef.current === scope) return;
    narrationScopeRef.current = scope;
    narrationRunRef.current += 1;
    stopNarration();
    setSpeaking(false);
  }, [activeStep, plan.id, step?.id]);

  useEffect(() => {
    if (!settings.voiceEnabled) {
      narrationRunRef.current += 1;
      stopNarration();
      setSpeaking(false);
    }
  }, [settings.voiceEnabled]);

  useEffect(() => {
    if (!expanded) return;
    const shell = document.querySelector<HTMLElement>(".desktop-shell");
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    shell?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => expandedCloseRef.current?.focus());
    return () => {
      shell?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.setTimeout(() => expandButtonRef.current?.focus(), 0);
    };
  }, [expanded]);

  const speak = async () => {
    if (!settings.voiceEnabled) return;
    if (speaking) {
      narrationRunRef.current += 1;
      stopNarration();
      setSpeaking(false);
      return;
    }
    const run = narrationRunRef.current + 1;
    narrationRunRef.current = run;
    setSpeaking(true);
    setError(undefined);
    try {
      await speakNarration(
        step?.narration ?? plan.narration,
        settings.voice,
        settings.speechRate,
        plan.provider.id === "openai",
      );
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      if (narrationRunRef.current === run) setSpeaking(false);
    }
  };

  const adapt = async (complexity: "simpler" | "advanced", followUp?: string) => {
    setAdapting(followUp ?? complexity);
    setError(undefined);
    try {
      await onRegenerate(complexity, followUp);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setAdapting(undefined);
    }
  };

  const rate = async (helpful: boolean) => {
    setFeedback(helpful);
    if (isTauriRuntime()) await desktop.setLessonFeedback(plan.id, helpful).catch(() => undefined);
  };

  const claimCitation = useMemo(
    () => new Map(plan.citations.map((citation) => [citation.id, citation])),
    [plan.citations],
  );

  const renderTransport = (expandedView: boolean) => (
    <div className={`transport-bar ${expandedView ? "expanded-transport" : ""}`}>
      <button
        type="button"
        onClick={() => setActiveStep((value) => Math.max(0, value - 1))}
        disabled={activeStep === 0}
        aria-label="Previous step"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        className="play-button"
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? "Play" : "Pause"}
      >
        {paused ? <Play size={18} /> : <Pause size={18} />}
      </button>
      <button
        type="button"
        onClick={() => {
          setActiveStep(0);
          setReplayKey((value) => value + 1);
          setPaused(false);
        }}
        aria-label="Replay"
      >
        <RotateCcw size={17} />
      </button>
      <span className="transport-progress">
        <span style={{ width: `${((activeStep + 1) / plan.steps.length) * 100}%` }} />
      </span>
      <span className="step-count">
        {activeStep + 1} / {plan.steps.length}
      </span>
      <button
        type="button"
        onClick={() => setActiveStep((value) => Math.min(plan.steps.length - 1, value + 1))}
        disabled={activeStep === plan.steps.length - 1}
        aria-label="Next step"
      >
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        onClick={speak}
        className={speaking ? "active" : ""}
        disabled={!settings.voiceEnabled}
        aria-label={
          !settings.voiceEnabled
            ? "Narration disabled in Settings"
            : speaking
              ? "Stop narration"
              : "Speak this step"
        }
        title={!settings.voiceEnabled ? "Narration is disabled in Settings" : undefined}
      >
        {speaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        type="button"
        onClick={() => setShowControls((value) => !value)}
        className={showControls ? "active" : ""}
      >
        <SlidersHorizontal size={17} /> Let me control
      </button>
      {!expandedView && (
        <button
          ref={expandButtonRef}
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand visualization"
          aria-expanded={expanded}
        >
          <Maximize2 size={17} />
        </button>
      )}
    </div>
  );

  const renderControls = (expandedView: boolean) => (
    <section
      className={`lab-controls ${expandedView ? "expanded-lab-controls" : ""}`}
      aria-label="Simulation controls"
    >
      {plan.controls.map((item) => {
        const value = controlValues[item.bind] ?? item.value;
        return (
          <label key={item.id}>
            <span>
              <strong>{item.label}</strong>
              <output>
                {value.toLocaleString(undefined, { maximumFractionDigits: 3 })} {item.unit}
              </output>
            </span>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={value}
              onChange={(event) =>
                setControlValues((current) => ({
                  ...current,
                  [item.bind]: Number(event.target.value),
                }))
              }
            />
          </label>
        );
      })}
      <button type="button" onClick={() => setControlValues(initialControlValues(plan))}>
        <RefreshCw size={15} /> Reset
      </button>
    </section>
  );

  return (
    <>
      <div className="lesson-page">
        <header className="lesson-header">
          <button type="button" className="back-button" onClick={onClose}>
            <ChevronLeft size={18} /> Back
          </button>
          <div className="lesson-title-group">
            <span className="eyebrow lesson-breadcrumb">
              <BookOpenCheck size={14} /> {plan.concept}
            </span>
            <h1>{plan.title}</h1>
            <p>{plan.summary}</p>
          </div>
          <div className={`confidence-badge ${plan.confidence}`}>
            <BookOpenCheck size={16} /> {confidenceLabel(plan.confidence)}
          </div>
        </header>

        {plan.uncertainty && (
          <div className="uncertainty-note">
            <Gauge size={16} />
            <span>
              <strong>Model boundary:</strong> {plan.uncertainty}
            </span>
          </div>
        )}

        <div className="lesson-workspace">
          <section className="lesson-main-column">
            <LessonRenderer
              plan={plan}
              activeStep={activeStep}
              controlValues={controlValues}
              paused={paused || expanded}
              replayKey={replayKey}
              reducedMotion={settings.reducedMotion}
            />
            {renderTransport(false)}

            {showControls && plan.controls.length > 0 && renderControls(false)}

            <section key={step?.id} className="narration-card">
              <div className="narration-number">{String(activeStep + 1).padStart(2, "0")}</div>
              <div>
                <span>Current explanation</span>
                <h2>{step?.title}</h2>
                <p>{step?.narration}</p>
                {step?.checkpoint && <blockquote>{step.checkpoint}</blockquote>}
              </div>
            </section>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </section>

          <aside className="lesson-steps-panel">
            <div className="panel-heading">
              <span>Lesson path</span>
              <small>{plan.teachingMode.replaceAll("-", " ")}</small>
            </div>
            <ol>
              {plan.steps.map((item, index) => (
                <li
                  key={item.id}
                  className={index === activeStep ? "active" : index < activeStep ? "complete" : ""}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStep(index);
                      setPaused(true);
                    }}
                  >
                    <span>{index < activeStep ? "✓" : index + 1}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{Math.ceil(item.durationMs / 1000)} sec</small>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
            <div className="adapt-card">
              <span>
                <SlidersHorizontal size={16} /> Change level
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => adapt("simpler")}
                  disabled={!request || Boolean(adapting)}
                >
                  Make it simpler
                </button>
                <button
                  type="button"
                  onClick={() => adapt("advanced")}
                  disabled={!request || Boolean(adapting)}
                >
                  Go deeper
                </button>
              </div>
              {adapting && <Spinner label="Recompiling" />}
              {!request && (
                <small className="adapt-disabled-note">
                  Start a fresh capture to rebuild this saved lesson.
                </small>
              )}
            </div>
          </aside>
        </div>

        <section className="lesson-evidence">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Evidence</span>
              <h2>Claims and boundaries</h2>
            </div>
            <small>{plan.sourceDescription}</small>
          </div>
          <div className="claim-grid">
            {plan.claims.map((claim) => (
              <article key={claim.id}>
                <span className={`evidence-tag ${claim.evidence}`}>
                  {claim.evidence.replace("-", " ")}
                </span>
                <p>{claim.text}</p>
                {claim.citationIds.map((id) => {
                  const citation = claimCitation.get(id);
                  return citation ? (
                    <button type="button" key={id} onClick={() => openUrl(citation.url)}>
                      {citation.title} <ExternalLink size={12} />
                    </button>
                  ) : null;
                })}
              </article>
            ))}
          </div>
          {plan.citations.length > 0 && (
            <div className="source-list">
              <h3>Sources</h3>
              {plan.citations.map((citation, index) => (
                <button type="button" key={citation.id} onClick={() => openUrl(citation.url)}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{citation.title}</strong>
                    <small>
                      {citation.source}
                      {citation.accessedAt ? ` · accessed ${citation.accessedAt}` : ""}
                    </small>
                  </div>
                  <ExternalLink size={15} />
                </button>
              ))}
            </div>
          )}
          <ImageAids plan={plan} />
        </section>

        <section className="follow-up-section">
          <div>
            <span className="eyebrow">Next questions</span>
            <h2>Continue from this lesson</h2>
          </div>
          <div className="follow-up-pills">
            {plan.followUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => adapt("advanced", followUp)}
                disabled={!request || Boolean(adapting)}
              >
                {followUp} <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="lesson-feedback">
            <span>Was this useful?</span>
            <button
              type="button"
              className={feedback === true ? "active" : ""}
              onClick={() => rate(true)}
            >
              <ThumbsUp size={16} />
            </button>
            <button
              type="button"
              className={feedback === false ? "active" : ""}
              onClick={() => rate(false)}
            >
              <ThumbsDown size={16} />
            </button>
          </div>
        </section>
      </div>
      {expanded &&
        createPortal(
          <section
            className={`visualization-overlay ${settings.reducedMotion ? "reduce-motion" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded visualization: ${plan.title}`}
          >
            <header className="visualization-overlay-header">
              <div>
                <span>Expanded visualization</span>
                <strong>{plan.title}</strong>
              </div>
              <div className="visualization-overlay-step" aria-live="polite">
                <span>
                  Step {activeStep + 1} of {plan.steps.length}
                </span>
                <strong>{step?.title}</strong>
              </div>
              <button
                ref={expandedCloseRef}
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Exit expanded visualization"
              >
                <Minimize2 size={17} /> Exit view <kbd>Esc</kbd>
              </button>
            </header>
            <div className="visualization-overlay-stage">
              <LessonRenderer
                plan={plan}
                activeStep={activeStep}
                controlValues={controlValues}
                paused={paused}
                replayKey={replayKey}
                reducedMotion={settings.reducedMotion}
              />
            </div>
            <div className="visualization-overlay-footer">
              {renderTransport(true)}
              {showControls && plan.controls.length > 0 && renderControls(true)}
            </div>
          </section>,
          document.body,
        )}
    </>
  );
}
