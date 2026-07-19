import { ArrowUp, Mic, MousePointer2, Scan, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppBootstrap,
  LauncherMode,
  LessonProgress,
  PreparedContext,
  ResearchMode,
  WakeListenerStatus,
} from "../../../shared/types";
import { openConfiguredMicrophone, rmsLevel } from "../audio";
import { BrandMark } from "../components/BrandMark";
import { errorMessage, Spinner } from "../components/Ui";

const EMPTY_LEVELS = [0.08, 0.12, 0.09, 0.15, 0.1, 0.13, 0.08, 0.12, 0.09, 0.14, 0.1, 0.12];

export function Launcher() {
  const [mode, setMode] = useState<LauncherMode>("idle");
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [context, setContext] = useState<PreparedContext | null>(null);
  const [question, setQuestion] = useState("");
  const [research, setResearch] = useState<ResearchMode>("quick");
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceLevels, setVoiceLevels] = useState(EMPTY_LEVELS);
  const [wakeLevel, setWakeLevel] = useState(0);
  const [wakeStatus, setWakeStatus] = useState<WakeListenerStatus | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const monitorTimer = useRef<number | null>(null);
  const captureButton = useRef<HTMLButtonElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const bootstrapRef = useRef<AppBootstrap | null>(null);
  const contextRef = useRef<PreparedContext | null>(null);
  const researchRef = useRef<ResearchMode>("quick");

  bootstrapRef.current = bootstrap;
  contextRef.current = context;
  researchRef.current = research;

  const stopAudioMonitoring = useCallback((): void => {
    if (monitorTimer.current) window.clearTimeout(monitorTimer.current);
    monitorTimer.current = null;
    const activeContext = audioContext.current;
    audioContext.current = null;
    if (activeContext && activeContext.state !== "closed") void activeContext.close();
    setVoiceLevels(EMPTY_LEVELS);
  }, []);

  const submitText = useCallback(async (rawQuestion: string): Promise<void> => {
    const activeBootstrap = bootstrapRef.current;
    const activeContext = contextRef.current;
    const nextQuestion = rawQuestion.trim();
    if (!activeBootstrap || !activeContext || !nextQuestion) return;
    const settings = activeBootstrap.settings;
    const researchMode = researchRef.current;
    setQuestion(nextQuestion);
    setError("");
    setMode("thinking");
    setProgress({
      requestId: "pending",
      stage: "preparing",
      message: "Preparing your visual lesson",
    });
    try {
      await window.showme.lesson.generate({
        captureId: activeContext.captureId,
        question: nextQuestion,
        includeNearbyContext: settings.nearbyContextDefault,
        includeActiveWindow: settings.activeWindowDefault,
        researchMode,
        allowWebResearch: researchMode === "deep" || settings.webResearchDefault,
        allowImageAids: settings.imageAidsDefault,
        language: settings.language,
        teachingStyle: settings.teachingStyle,
        complexity: "standard",
        provider: settings.provider,
        model: settings.models[settings.provider],
      });
      setQuestion("");
      setContext(null);
    } catch (reason) {
      setError(errorMessage(reason));
      setMode("question");
    }
  }, []);

  const startRecording = useCallback(
    async (automatic = false): Promise<void> => {
      if (recorder.current) return;
      setError("");
      try {
        const settings = bootstrapRef.current?.settings;
        if (!settings) throw new Error("ShowME is still loading audio settings.");
        const { stream, fellBackToDefault } = await openConfiguredMicrophone(settings);
        if (fellBackToDefault) {
          setError("The saved microphone is unavailable, so ShowME used the system default.");
        }
        const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const next = new MediaRecorder(stream, { mimeType: preferred });
        const nextAudioContext = new AudioContext({ latencyHint: "interactive" });
        const source = nextAudioContext.createMediaStreamSource(stream);
        const analyser = nextAudioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.68;
        source.connect(analyser);
        audioContext.current = nextAudioContext;
        chunks.current = [];
        let heardSpeech = false;
        let lastSpeechAt = performance.now();
        const startedAt = performance.now();
        let history = [...EMPTY_LEVELS];
        const samples = new Uint8Array(analyser.fftSize);

        const monitor = (): void => {
          if (next.state === "inactive") return;
          analyser.getByteTimeDomainData(samples);
          const rms = rmsLevel(samples);
          const level = Math.min(1, Math.max(0.05, rms * 8.5));
          history = [...history.slice(1), level];
          setVoiceLevels(history);

          const now = performance.now();
          if (automatic && rms > 0.028) {
            heardSpeech = true;
            lastSpeechAt = now;
          }
          const finishedBySilence =
            automatic && heardSpeech && now - lastSpeechAt > settings.voiceSilenceMs;
          const reachedLimit = now - startedAt > settings.voiceMaxSeconds * 1000;
          if (finishedBySilence || reachedLimit) next.stop();
          else monitorTimer.current = window.setTimeout(monitor, 46);
        };

        next.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.current.push(event.data);
        };
        next.onstop = async () => {
          recorder.current = null;
          setRecording(false);
          stopAudioMonitoring();
          for (const track of stream.getTracks()) track.stop();
          const blob = new Blob(chunks.current, { type: next.mimeType });
          if (blob.size === 0) {
            setMode("question");
            await window.showme.launcher.setMode("question");
            await window.showme.voice.activity("idle");
            return;
          }
          setTranscribing(true);
          setMode("transcribing");
          await window.showme.voice.activity("transcribing");
          try {
            const text = (
              await window.showme.voice.transcribe({
                bytes: new Uint8Array(await blob.arrayBuffer()),
                mimeType: next.mimeType,
              })
            ).trim();
            if (!text) throw new Error("ShowME did not hear a question. Please try again.");
            if (automatic) {
              setQuestion(text);
              await window.showme.voice.activity("idle");
              await submitText(text);
            } else {
              setQuestion((current) => (current ? current + " " : "") + text);
              setMode("question");
              await window.showme.launcher.setMode("question");
              await window.showme.voice.activity("idle");
            }
          } catch (reason) {
            setError(errorMessage(reason));
            setMode("question");
            await window.showme.launcher.setMode("question");
            await window.showme.voice.activity("idle");
          } finally {
            setTranscribing(false);
          }
        };
        recorder.current = next;
        next.start(160);
        setRecording(true);
        setMode("listening");
        await window.showme.voice.activity("listening");
        monitor();
      } catch (reason) {
        setError(errorMessage(reason));
        setMode("question");
        await window.showme.launcher.setMode("question");
        await window.showme.voice.activity("idle");
      }
    },
    [stopAudioMonitoring, submitText],
  );

  const closeQuestion = useCallback(async (): Promise<void> => {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stopAudioMonitoring();
    setQuestion("");
    setContext(null);
    setError("");
    await window.showme.capture.clear();
    await window.showme.launcher.setMode("idle");
    await window.showme.voice.activity("idle");
  }, [stopAudioMonitoring]);

  useEffect(() => {
    void window.showme.app
      .bootstrap()
      .then((value) => {
        setBootstrap(value);
        setResearch(value.settings.researchMode);
      })
      .catch((reason) => setError(errorMessage(reason)));
    void window.showme.capture.prepared().then((value) => {
      if (value) setContext(value);
    });
    const cleanups = [
      window.showme.events.onLauncherMode(setMode),
      window.showme.events.onContextReady((value) => {
        setContext(value);
        setMode("question");
        setError("");
      }),
      window.showme.events.onLessonProgress((value) => {
        setProgress(value);
        setMode("thinking");
      }),
      window.showme.events.onVoiceLevel(setWakeLevel),
      window.showme.events.onWakeDetected(() => void startRecording(true)),
      window.showme.events.onWakeStatus(setWakeStatus),
      window.showme.events.onSettingsChanged((settings) => {
        setBootstrap((current) => (current ? { ...current, settings } : current));
      }),
    ];
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") void closeQuestion();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener("keydown", onKey);
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
      stopAudioMonitoring();
    };
  }, [closeQuestion, startRecording, stopAudioMonitoring]);

  useEffect(() => {
    if (mode !== "revealed") return;
    const frame = window.requestAnimationFrame(() =>
      captureButton.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const reveal = (): void => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    if (mode === "idle") void window.showme.launcher.setMode("revealed");
  };

  const conceal = (): void => {
    if (mode !== "revealed") return;
    leaveTimer.current = window.setTimeout(() => void window.showme.launcher.setMode("idle"), 420);
  };

  const beginCapture = async (): Promise<void> => {
    setError("");
    try {
      await window.showme.capture.begin();
    } catch (reason) {
      setError(errorMessage(reason));
      setMode("revealed");
    }
  };

  const toggleRecording = async (): Promise<void> => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    await startRecording(false);
  };

  if (mode === "idle") {
    const wakeEnabled = bootstrap?.settings.wakeEnabled ?? false;
    const listenerReady =
      wakeStatus?.state === "ready" || bootstrap?.wakeListener.state === "ready";
    return (
      <div
        className={
          "island-stage idle" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")
        }
      >
        <button
          className="island-grip"
          aria-label={
            wakeEnabled && listenerReady
              ? "ShowME is listening locally; click to open"
              : wakeEnabled
                ? "ShowME wake listener needs attention; click to open"
                : "Open ShowME"
          }
          title={wakeStatus?.message ?? bootstrap?.wakeListener.message}
          onClick={reveal}
          type="button"
        >
          {wakeEnabled ? (
            <StandbyWave level={wakeLevel} ready={Boolean(listenerReady)} />
          ) : (
            <span className="island-grip-mark" />
          )}
        </button>
      </div>
    );
  }

  if (mode === "revealed") {
    return (
      <div
        className={"island-stage" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")}
        onPointerEnter={reveal}
        onPointerLeave={conceal}
      >
        <div className="dynamic-island reveal-island">
          <button
            className="capture-affordance"
            onClick={beginCapture}
            ref={captureButton}
            type="button"
          >
            <span className="capture-glyph">
              <Scan size={20} strokeWidth={1.8} />
            </span>
            <span className="capture-copy">
              <strong>Show me this</strong>
              <small>Select an area, point, or the whole screen</small>
            </span>
            <span className="launcher-shortcut" aria-hidden="true">
              <kbd>Space</kbd>
              <small>select</small>
            </span>
          </button>
        </div>
        {error ? <div className="island-error">{error}</div> : null}
      </div>
    );
  }

  if (mode === "listening" || mode === "transcribing" || mode === "speaking") {
    const assistantName = bootstrap?.settings.assistantName ?? "ShowME";
    const labels = voiceCopy(mode, assistantName);
    return (
      <div
        className={"island-stage" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")}
      >
        <section className={"dynamic-island voice-island voice-" + mode}>
          <span className="voice-brand">
            <BrandMark size={20} />
          </span>
          <span className="voice-copy">
            <strong>{labels.title}</strong>
            <small>{labels.detail}</small>
          </span>
          <AudioWave levels={mode === "listening" ? voiceLevels : EMPTY_LEVELS} state={mode} />
          {mode === "listening" ? (
            <button
              className="voice-stop"
              aria-label="Stop listening"
              onClick={() => recorder.current?.stop()}
              type="button"
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (mode === "thinking") {
    return (
      <div
        className={"island-stage" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")}
      >
        <div className="dynamic-island thinking-island">
          <div className="thinking-orb">
            <BrandMark size={19} />
          </div>
          <div>
            <strong>{progress?.message ?? "Building your lesson"}</strong>
            <small>{progressLabel(progress?.stage)}</small>
          </div>
          <AudioWave levels={EMPTY_LEVELS} state="thinking" />
        </div>
      </div>
    );
  }

  const provider = bootstrap?.providers.find((item) => item.id === bootstrap.settings.provider);
  return (
    <div
      className={
        "island-stage question-stage" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")
      }
    >
      <section className="dynamic-island question-island">
        <header>
          <div className="question-context">
            {context ? (
              <img src={context.previewDataUrl} alt="Selected screen context" />
            ) : (
              <MousePointer2 size={18} />
            )}
            <span>
              <strong>{context?.scope === "selection" ? "Selection ready" : "Screen ready"}</strong>
              <small>{provider?.name ?? "Choose a provider in ShowME"}</small>
            </span>
          </div>
          <button className="ghost-icon" aria-label="Close" onClick={closeQuestion} type="button">
            <X size={16} />
          </button>
        </header>
        <div className="question-composer">
          <textarea
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitText(question);
              }
            }}
            placeholder={
              bootstrap
                ? "Ask " + bootstrap.settings.assistantName + " what should become clear"
                : "What should become clear?"
            }
            value={question}
          />
          <button
            className={"mic-button" + (recording ? " recording" : "")}
            aria-label={recording ? "Stop recording" : "Ask with voice"}
            onClick={toggleRecording}
            type="button"
          >
            {transcribing ? (
              <Spinner small />
            ) : recording ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Mic size={18} />
            )}
          </button>
        </div>
        <footer>
          <fieldset className="research-switch" aria-label="Research depth">
            <button
              className={research === "quick" ? "active" : ""}
              onClick={() => setResearch("quick")}
              type="button"
            >
              Quick
            </button>
            <button
              className={research === "deep" ? "active" : ""}
              onClick={() => setResearch("deep")}
              type="button"
            >
              Deep · cited
            </button>
          </fieldset>
          <button
            className="send-button"
            disabled={!question.trim() || !context || !bootstrap}
            onClick={() => void submitText(question)}
            type="button"
          >
            Build lesson <ArrowUp size={16} />
          </button>
        </footer>
        {error ? <div className="composer-error">{error}</div> : null}
      </section>
    </div>
  );
}

function StandbyWave({ level, ready }: { level: number; ready: boolean }) {
  const shape = [0.26, 0.42, 0.58, 0.76, 0.92, 0.68, 1, 0.7, 0.9, 0.74, 0.56, 0.4, 0.24];
  return (
    <span className={"standby-wave" + (ready ? "" : " listener-error")} aria-hidden="true">
      {shape.map((weight, index) => (
        <span
          key={String(index)}
          style={{
            height: Math.max(1, Math.min(7, Math.round(1 + level * 8 * weight))),
            opacity: 0.42 + level * 0.58,
          }}
        />
      ))}
    </span>
  );
}

function AudioWave({ levels, state }: { levels: number[]; state: LauncherMode | "thinking" }) {
  return (
    <span className={"audio-wave audio-wave-" + state} aria-hidden="true">
      {levels.map((level, index) => (
        <span
          key={String(index)}
          style={{ transform: "scaleY(" + Math.max(0.16, level).toFixed(2) + ")" }}
        />
      ))}
    </span>
  );
}

function voiceCopy(mode: "listening" | "transcribing" | "speaking", assistantName: string) {
  if (mode === "listening") {
    return { title: assistantName + " is listening", detail: "Ask what you want to understand" };
  }
  if (mode === "transcribing") {
    return { title: "Understanding your request", detail: "Turning your voice into a question" };
  }
  return { title: assistantName + " is speaking", detail: "Following the lesson narration" };
}

function progressLabel(stage: LessonProgress["stage"] | undefined): string {
  const labels: Record<LessonProgress["stage"], string> = {
    preparing: "Context stays in memory",
    understanding: "Finding the visual idea",
    researching: "Following source evidence",
    verifying: "Checking the moving parts",
    rendering: "Laying out the story",
  };
  return stage ? labels[stage] : "Visual lesson compiler";
}
