import {
  AlertCircle,
  ArrowUp,
  LoaderCircle,
  LockKeyhole,
  MousePointer2,
  Scan,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  calibratedSpeechThreshold,
  downsampleToPcm16,
  floatRmsLevel,
  frequencySpectrumLevels,
  VoiceEndpointDetector,
  WakeUtteranceCollector,
} from "../../../shared/audio";
import { launcherActivityVisual } from "../../../shared/launcher";
import type {
  AppBootstrap,
  LauncherMode,
  LessonProgress,
  PreparedContext,
  WakeListenerStatus,
} from "../../../shared/types";
import { openConfiguredMicrophone, rmsLevel } from "../audio";
import { BrandMark } from "../components/BrandMark";
import { errorMessage } from "../components/Ui";

const EMPTY_LEVELS = [0.08, 0.12, 0.09, 0.15, 0.1, 0.13, 0.08, 0.12, 0.09, 0.14, 0.1, 0.12];

export function Launcher() {
  const [mode, setMode] = useState<LauncherMode>("idle");
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [context, setContext] = useState<PreparedContext | null>(null);
  const [question, setQuestion] = useState("");
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [error, setError] = useState("");
  const [errorTitle, setErrorTitle] = useState("ShowME couldn't continue");
  const [, setRecording] = useState(false);
  const [, setTranscribing] = useState(false);
  const [voiceLevels, setVoiceLevels] = useState(EMPTY_LEVELS);
  const [wakeLevel, setWakeLevel] = useState(0);
  const [wakeStatus, setWakeStatus] = useState<WakeListenerStatus | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const monitorTimer = useRef<number | null>(null);
  const captureButton = useRef<HTMLButtonElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const wakeStream = useRef<MediaStream | null>(null);
  const wakeContext = useRef<AudioContext | null>(null);
  const wakeProcessor = useRef<ScriptProcessorNode | null>(null);
  const wakeSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const wakeMute = useRef<GainNode | null>(null);
  const wakeGeneration = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const bootstrapRef = useRef<AppBootstrap | null>(null);
  const contextRef = useRef<PreparedContext | null>(null);

  bootstrapRef.current = bootstrap;
  contextRef.current = context;

  const stopAudioMonitoring = useCallback((): void => {
    if (monitorTimer.current) window.clearTimeout(monitorTimer.current);
    monitorTimer.current = null;
    const activeContext = audioContext.current;
    audioContext.current = null;
    if (activeContext && activeContext.state !== "closed") void activeContext.close();
    setVoiceLevels(EMPTY_LEVELS);
  }, []);

  const stopWakeInput = useCallback(
    (reportStopped = false, preserveStream = false): MediaStream | null => {
      wakeGeneration.current += 1;
      if (wakeProcessor.current) wakeProcessor.current.onaudioprocess = null;
      wakeProcessor.current?.disconnect();
      wakeSource.current?.disconnect();
      wakeMute.current?.disconnect();
      wakeProcessor.current = null;
      wakeSource.current = null;
      wakeMute.current = null;
      const stream = wakeStream.current;
      if (!preserveStream) {
        for (const track of stream?.getTracks() ?? []) track.stop();
      }
      wakeStream.current = null;
      const context = wakeContext.current;
      wakeContext.current = null;
      if (context && context.state !== "closed") void context.close();
      setWakeLevel(0);
      if (reportStopped) {
        window.showme.wake.inputState({
          state: "stopped",
          message: "Wake microphone standby is off.",
        });
      }
      return preserveStream ? stream : null;
    },
    [],
  );

  const startWakeInput = useCallback(
    async (settings: AppBootstrap["settings"]): Promise<void> => {
      stopWakeInput(false);
      const generation = wakeGeneration.current + 1;
      wakeGeneration.current = generation;
      window.showme.wake.inputState({
        state: "starting",
        message: "Opening the selected microphone; speak once to verify its signal.",
      });
      try {
        const opened = await openConfiguredMicrophone(settings);
        if (wakeGeneration.current !== generation) {
          for (const staleTrack of opened.stream.getTracks()) staleTrack.stop();
          return;
        }
        const track = opened.stream.getAudioTracks()[0];
        if (!track) throw new Error("The selected microphone did not provide an audio track.");
        const detectedDeviceLabel = track.label || "selected microphone";
        const deviceLabel = opened.fellBackToDefault
          ? `System default fallback: ${detectedDeviceLabel}`
          : detectedDeviceLabel;
        const context = new AudioContext({ latencyHint: "interactive" });
        await context.resume();
        if (wakeGeneration.current !== generation) {
          for (const staleTrack of opened.stream.getTracks()) staleTrack.stop();
          await context.close();
          return;
        }
        const source = context.createMediaStreamSource(opened.stream);
        const processor = context.createScriptProcessor(2048, 1, 1);
        const mute = context.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute);
        mute.connect(context.destination);
        wakeStream.current = opened.stream;
        wakeContext.current = context;
        wakeSource.current = source;
        wakeProcessor.current = processor;
        wakeMute.current = mute;
        const utterances = new WakeUtteranceCollector();
        let noiseFloor = Number.POSITIVE_INFINITY;
        const openedAt = performance.now();
        processor.onaudioprocess = (event) => {
          if (wakeGeneration.current !== generation) return;
          const samples = event.inputBuffer.getChannelData(0);
          const rms = floatRmsLevel(samples);
          setWakeLevel(Math.min(1, rms * 26));
          if (performance.now() - openedAt < 800 && !utterances.isActive()) {
            noiseFloor = Math.min(noiseFloor, rms);
          }
          const pcm = downsampleToPcm16(samples, context.sampleRate);
          const utterance = utterances.push(pcm, rms >= calibratedSpeechThreshold(noiseFloor));
          if (utterance) {
            window.showme.wake.pushAudio(
              new Uint8Array(utterance.buffer, utterance.byteOffset, utterance.byteLength),
            );
          }
        };
        track.addEventListener(
          "ended",
          () => {
            if (wakeGeneration.current !== generation) return;
            window.showme.wake.inputState({
              state: "error",
              message:
                "The wake microphone disconnected. Choose another input in Voice & language.",
              deviceLabel,
            });
            stopWakeInput(false);
          },
          { once: true },
        );
        window.showme.wake.inputState({
          state: "ready",
          message: opened.fellBackToDefault
            ? "The saved microphone was unavailable; wake listening is using the system default."
            : "The selected microphone is open and ready.",
          deviceLabel,
        });
      } catch (reason) {
        if (wakeGeneration.current !== generation) return;
        stopWakeInput(false);
        window.showme.wake.inputState({
          state: "error",
          message: `Wake microphone unavailable: ${errorMessage(reason)}`,
        });
      }
    },
    [stopWakeInput],
  );

  const finishVoiceWithError = useCallback(
    async (message: string, title = "Voice unavailable"): Promise<void> => {
      setErrorTitle(title);
      setError(message);
      setQuestion("");
      setContext(null);
      contextRef.current = null;
      await window.showme.capture.clear();
      setMode("revealed");
      await window.showme.launcher.setMode("revealed");
      await window.showme.voice.activity("idle");
    },
    [],
  );

  const submitText = useCallback(
    async (rawQuestion: string, replyWithVoice = false): Promise<void> => {
      const activeBootstrap = bootstrapRef.current;
      const activeContext = contextRef.current;
      const nextQuestion = rawQuestion.trim();
      if (!activeBootstrap || !activeContext || !nextQuestion) return;
      const settings = activeBootstrap.settings;
      const researchMode = settings.researchMode;
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
          replyWithVoice,
        });
        if (replyWithVoice) await window.showme.voice.activity("idle");
        setQuestion("");
        setContext(null);
      } catch (reason) {
        const message = errorMessage(reason);
        if (replyWithVoice) await finishVoiceWithError(message, "Lesson unavailable");
        else {
          setError(message);
          setMode("question");
        }
      }
    },
    [finishVoiceWithError],
  );

  const startRecording = useCallback(async (): Promise<void> => {
    if (recorder.current) return;
    let stream = stopWakeInput(false, true);
    setError("");
    try {
      const settings = bootstrapRef.current?.settings;
      if (!settings) throw new Error("ShowME is still loading audio settings.");
      let fellBackToDefault = false;
      if (
        !stream?.active ||
        stream.getAudioTracks().every((track) => track.readyState !== "live")
      ) {
        for (const track of stream?.getTracks() ?? []) track.stop();
        const opened = await openConfiguredMicrophone(settings);
        stream = opened.stream;
        fellBackToDefault = opened.fellBackToDefault;
      }
      if (fellBackToDefault) {
        setError("The saved microphone is unavailable, so ShowME used the system default.");
      }
      if (!stream) throw new Error("ShowME could not open the selected microphone.");
      const recordingStream = stream;
      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const next = new MediaRecorder(recordingStream, { mimeType: preferred });
      const nextAudioContext = new AudioContext({ latencyHint: "interactive" });
      await nextAudioContext.resume();
      const source = nextAudioContext.createMediaStreamSource(recordingStream);
      const analyser = nextAudioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      audioContext.current = nextAudioContext;
      chunks.current = [];
      const endpoint = new VoiceEndpointDetector(
        settings.voiceSilenceMs,
        settings.voiceMaxSeconds * 1000,
      );
      const samples = new Uint8Array(analyser.fftSize);
      const frequencyBins = new Uint8Array(analyser.frequencyBinCount);

      const monitor = (): void => {
        if (next.state === "inactive") return;
        analyser.getByteTimeDomainData(samples);
        analyser.getByteFrequencyData(frequencyBins);
        const rms = rmsLevel(samples);
        setVoiceLevels(frequencySpectrumLevels(frequencyBins, EMPTY_LEVELS.length));

        const decision = endpoint.push(rms, performance.now());
        if (decision !== "continue") {
          if (endpoint.hasHeardSpeech()) {
            setMode("transcribing");
            void window.showme.voice.activity("transcribing");
          }
          next.stop();
        } else monitorTimer.current = window.setTimeout(monitor, 32);
      };

      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      next.onstop = async () => {
        recorder.current = null;
        setRecording(false);
        stopAudioMonitoring();
        for (const track of recordingStream.getTracks()) track.stop();
        const blob = new Blob(chunks.current, { type: next.mimeType });
        if (blob.size === 0 || !endpoint.hasHeardSpeech()) {
          await finishVoiceWithError("ShowME did not hear a question. Please try again.");
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
          setQuestion(text);
          await submitText(text, true);
        } catch (reason) {
          await finishVoiceWithError(errorMessage(reason));
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
      for (const track of stream?.getTracks() ?? []) track.stop();
      await finishVoiceWithError(errorMessage(reason));
    }
  }, [finishVoiceWithError, stopAudioMonitoring, stopWakeInput, submitText]);

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
      window.showme.events.onWakeDetected((value) => {
        contextRef.current = value;
        setContext(value);
        setMode("listening");
        setError("");
        void startRecording();
      }),
      window.showme.events.onWakeStatus(setWakeStatus),
      window.showme.events.onSettingsChanged((settings) => {
        setBootstrap((current) => (current ? { ...current, settings } : current));
      }),
      window.showme.events.onVoicePlaybackError((message) => {
        setErrorTitle("Voice unavailable");
        setError(message);
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
      stopWakeInput(false);
    };
  }, [closeQuestion, startRecording, stopAudioMonitoring, stopWakeInput]);

  useEffect(() => {
    const settings = bootstrap?.settings;
    if (!settings || bootstrap.platform !== "win32") return;
    if (!settings.wakeEnabled) {
      stopWakeInput(true);
      return;
    }
    if (
      mode === "idle" ||
      mode === "revealed" ||
      mode === "speaking" ||
      mode === "teaching" ||
      mode === "waiting" ||
      mode === "complete"
    ) {
      void startWakeInput(settings);
    } else {
      stopWakeInput(false);
    }
    return () => {
      stopWakeInput(false);
    };
  }, [bootstrap?.platform, bootstrap?.settings, mode, startWakeInput, stopWakeInput]);

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
      setMode("capturing");
      await window.showme.launcher.setMode("capturing");
      await window.showme.capture.begin();
    } catch (reason) {
      setErrorTitle("Capture unavailable");
      setError(errorMessage(reason));
      setMode("revealed");
    }
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
        onPointerEnter={reveal}
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
          onPointerEnter={reveal}
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
          {error ? (
            <div className="launcher-error-inline" role="status">
              <AlertCircle size={15} />
              <span>
                <strong>{errorTitle}</strong>
                <small>{error}</small>
              </span>
              <button aria-label="Dismiss" onClick={() => setError("")} type="button">
                <X size={13} />
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  if (mode === "listening" || mode === "transcribing" || mode === "speaking") {
    const labels = voiceCopy(mode);
    const activityVisual = launcherActivityVisual(mode);
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
          {activityVisual === "input-waveform" ? (
            <AudioWave levels={voiceLevels} state="listening" />
          ) : activityVisual === "output-waveform" ? (
            <AudioWave levels={EMPTY_LEVELS} state="speaking" />
          ) : (
            <span className="activity-loader" aria-hidden="true">
              <LoaderCircle size={15} />
            </span>
          )}
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
          <ThinkingProgress stage={progress?.stage} />
        </div>
      </div>
    );
  }

  if (["capturing", "teaching", "waiting", "checking", "complete"].includes(mode)) {
    const copy = runtimeCopy(mode);
    return (
      <div
        className={"island-stage" + (bootstrap?.settings.reducedMotion ? " reduced-motion" : "")}
      >
        <div className={`dynamic-island thinking-island runtime-island runtime-${mode}`}>
          <div className="thinking-orb">
            <BrandMark size={19} />
          </div>
          <div>
            <strong>{copy.title}</strong>
            <small>{copy.detail}</small>
          </div>
          {mode === "capturing" || mode === "checking" ? (
            <span className="activity-loader" aria-hidden="true">
              <LoaderCircle size={15} />
            </span>
          ) : (
            <span className="runtime-state-dot" aria-hidden="true" />
          )}
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
              bootstrap ? "Ask ShowME what should become clear" : "What should become clear?"
            }
            value={question}
          />
          <span className="composer-hint">Enter builds | Shift + Enter adds a line</span>
        </div>
        <footer>
          <button
            className="send-button"
            disabled={!question.trim() || !context || !bootstrap}
            onClick={() => void submitText(question)}
            type="button"
          >
            Build lesson <ArrowUp size={16} />
          </button>
        </footer>
        {error ? (
          <div className="composer-error" role="alert">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="composer-status">
            <LockKeyhole size={10} />
            <span>Capture stays in memory and expires automatically</span>
          </div>
        )}
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

function AudioWave({ levels, state }: { levels: number[]; state: "listening" | "speaking" }) {
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

function ThinkingProgress({ stage }: { stage: LessonProgress["stage"] | undefined }) {
  const stages: LessonProgress["stage"][] = [
    "preparing",
    "understanding",
    "researching",
    "verifying",
    "rendering",
  ];
  const activeIndex = Math.max(0, stages.indexOf(stage ?? "preparing"));
  return (
    <span className="thinking-progress" aria-hidden="true">
      {stages.map((value, index) => (
        <span className={index <= activeIndex ? "active" : ""} key={value} />
      ))}
    </span>
  );
}

function voiceCopy(mode: "listening" | "transcribing" | "speaking") {
  if (mode === "listening") {
    return {
      title: "ShowME is listening",
      detail: "Finish your thought, then pause briefly",
    };
  }
  if (mode === "transcribing") {
    return { title: "Heard you — working now", detail: "Transcribing before lesson planning" };
  }
  return { title: "ShowME is speaking", detail: "Following the lesson narration" };
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

function runtimeCopy(mode: LauncherMode): { title: string; detail: string } {
  if (mode === "capturing")
    return { title: "Reading the selection", detail: "Capturing screen context" };
  if (mode === "teaching")
    return { title: "Teaching on screen", detail: "Drawing the next visual step" };
  if (mode === "waiting")
    return { title: "Your turn", detail: "ShowME is waiting for your answer" };
  if (mode === "checking") return { title: "Checking locally", detail: "No additional model call" };
  return { title: "Lesson complete", detail: "The board will clear automatically" };
}
