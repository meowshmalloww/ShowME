import { useCallback, useEffect, useRef, useState } from "react";
import { findSystemVoice } from "../../../shared/audio";
import {
  lessonBoardFadeMs,
  lessonBoardHoldMs,
  silentStepDurationMs,
} from "../../../shared/lesson-lifecycle";
import type {
  AppBootstrap,
  AppSettings,
  ImageAsset,
  LessonPresentation,
  SpokenLessonCommandEvent,
} from "../../../shared/types";
import { isLikelyNarrationEcho, parseVoiceLessonCommand } from "../../../shared/voice-command";
import { routeAudioOutput } from "../audio";
import { WhiteboardCanvas } from "../components/WhiteboardCanvas";
import {
  cloudPlaybackTimeoutMs,
  delayWithSignal,
  isAbortError,
  isPlayableAudioPayload,
  playAudioElement,
  playSystemUtterance,
  splitSpokenText,
  systemSpeechTimeoutMs,
} from "../speech-playback";

type CloudSpeech = { bytes: Uint8Array; mimeType: string };
type PreparedCloudSpeech = { ok: true; audio: CloudSpeech } | { ok: false; error: unknown };

export function LessonWindow() {
  const [presentation, setPresentation] = useState<LessonPresentation | null>(null);
  const [bootstrap, setBootstrap] = useState<AppBootstrap | null>(null);
  const [step, setStep] = useState(0);
  const [imageAsset, setImageAsset] = useState<ImageAsset>();
  const [boardPhase, setBoardPhase] = useState<"active" | "fading">("active");
  const presentationRef = useRef<LessonPresentation | null>(null);
  const bootstrapRef = useRef<AppBootstrap | null>(null);
  const pendingAutoplay = useRef<string | null>(null);
  const narrationVersion = useRef(0);
  const narrationController = useRef<AbortController | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrl = useRef<string | null>(null);
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const currentNarration = useRef("");
  const adapting = useRef(false);
  const boardTimers = useRef<number[]>([]);

  presentationRef.current = presentation;
  bootstrapRef.current = bootstrap;

  const stopPlayback = useCallback((announceIdle = true): void => {
    narrationVersion.current += 1;
    narrationController.current?.abort();
    narrationController.current = null;
    window.speechSynthesis?.cancel();
    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.removeAttribute("src");
      activeAudio.current.load();
    }
    activeAudio.current = null;
    if (activeAudioUrl.current) URL.revokeObjectURL(activeAudioUrl.current);
    activeAudioUrl.current = null;
    activeUtterance.current = null;
    currentNarration.current = "";
    if (announceIdle) void window.showme.voice.activity("idle");
  }, []);

  const clearBoardTimers = useCallback((): void => {
    for (const timer of boardTimers.current) window.clearTimeout(timer);
    boardTimers.current = [];
  }, []);

  const activateBoard = useCallback((): void => {
    clearBoardTimers();
    setBoardPhase("active");
  }, [clearBoardTimers]);

  const fadeAndCloseBoard = useCallback(
    (reducedMotion: boolean, userRequested = false): void => {
      clearBoardTimers();
      setBoardPhase("fading");
      const fadeMs = userRequested ? (reducedMotion ? 80 : 260) : lessonBoardFadeMs(reducedMotion);
      boardTimers.current.push(
        window.setTimeout(() => {
          void window.showme.lesson.close();
        }, fadeMs),
      );
    },
    [clearBoardTimers],
  );

  const scheduleBoardRetirement = useCallback(
    (value: LessonPresentation, settings: AppSettings): void => {
      clearBoardTimers();
      setBoardPhase("active");
      boardTimers.current.push(
        window.setTimeout(
          () => fadeAndCloseBoard(settings.reducedMotion),
          lessonBoardHoldMs(value.plan.steps.length),
        ),
      );
    },
    [clearBoardTimers, fadeAndCloseBoard],
  );

  const speakWithSystemVoice = useCallback(
    async (
      text: string,
      settings: AppSettings,
      version: number,
      signal: AbortSignal,
    ): Promise<void> => {
      const synthesis = window.speechSynthesis;
      if (!synthesis) throw new Error("Local speech is unavailable on this system.");
      const rate = Math.max(0.7, Math.min(1.3, settings.speechRate * 0.96));
      const selectedVoice = findSystemVoice(synthesis.getVoices(), settings.systemVoice);
      for (const chunk of splitSpokenText(text)) {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (signal.aborted || version !== narrationVersion.current) return;
          synthesis.cancel();
          await delayWithSignal(attempt === 0 ? 45 : 140, signal);
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.lang = settings.language;
          utterance.rate = rate;
          utterance.pitch = 1.02;
          if (selectedVoice) utterance.voice = selectedVoice;
          activeUtterance.current = utterance;
          try {
            await playSystemUtterance({
              synthesis,
              utterance,
              signal,
              completionTimeoutMs: systemSpeechTimeoutMs(chunk, rate),
            });
            lastError = undefined;
            break;
          } catch (error) {
            if (isAbortError(error) || signal.aborted) throw error;
            lastError = error;
            synthesis.cancel();
          } finally {
            if (activeUtterance.current === utterance) activeUtterance.current = null;
          }
        }
        if (lastError) throw lastError;
      }
    },
    [],
  );

  const speakWithCloudVoice = useCallback(
    async (
      text: string,
      settings: AppSettings,
      version: number,
      signal: AbortSignal,
      prepared?: CloudSpeech,
    ): Promise<void> => {
      const generated = prepared ?? (await window.showme.voice.synthesize(text));
      if (signal.aborted || version !== narrationVersion.current) return;
      const bytes = new Uint8Array(generated.bytes);
      if (!isPlayableAudioPayload(generated.mimeType, bytes.byteLength)) {
        throw new Error("The speech provider returned an empty or unsupported audio response.");
      }
      const url = URL.createObjectURL(new Blob([bytes.buffer], { type: generated.mimeType }));
      activeAudioUrl.current = url;
      try {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (signal.aborted || version !== narrationVersion.current) return;
          const audio = new Audio();
          audio.preload = "auto";
          audio.src = url;
          activeAudio.current = audio;
          try {
            const exactSpeaker = await routeAudioOutput(audio, settings.speakerDeviceId);
            if (!exactSpeaker) {
              console.warn("Saved speaker is unavailable; narration is using the system default.");
            }
            audio.load();
            await playAudioElement({
              audio,
              signal,
              completionTimeoutMs: cloudPlaybackTimeoutMs(text, settings.speechRate),
            });
            lastError = undefined;
            break;
          } catch (error) {
            if (isAbortError(error) || signal.aborted) throw error;
            lastError = error;
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
            if (attempt === 0) await delayWithSignal(120, signal);
          } finally {
            if (activeAudio.current === audio) activeAudio.current = null;
          }
        }
        if (lastError) throw lastError;
      } finally {
        if (activeAudioUrl.current === url) activeAudioUrl.current = null;
        URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const speakSegment = useCallback(
    async (
      text: string,
      settings: AppSettings,
      version: number,
      signal: AbortSignal,
      prepared?: PreparedCloudSpeech,
    ): Promise<boolean> => {
      if (settings.voiceOutputProvider === "system") {
        await speakWithSystemVoice(text, settings, version, signal);
        return false;
      }
      try {
        if (prepared && !prepared.ok) throw prepared.error;
        await speakWithCloudVoice(
          text,
          settings,
          version,
          signal,
          prepared?.ok ? prepared.audio : undefined,
        );
        return true;
      } catch (error) {
        if (isAbortError(error) || signal.aborted || version !== narrationVersion.current) {
          return false;
        }
        console.error("Cloud narration failed; using the local system voice.", error);
        await speakWithSystemVoice(text, settings, version, signal);
        return false;
      }
    },
    [speakWithCloudVoice, speakWithSystemVoice],
  );

  const playLesson = useCallback(
    async (value: LessonPresentation, settings: AppSettings): Promise<void> => {
      stopPlayback(false);
      const version = ++narrationVersion.current;
      const controller = new AbortController();
      narrationController.current = controller;
      const segments = value.plan.steps.length
        ? value.plan.steps.map((lessonStep) => lessonStep.narration)
        : [value.plan.narration];
      let cloudAvailable = settings.voiceOutputProvider !== "system";
      let preparedCloud = cloudAvailable
        ? prepareCloudSpeech(segments[0] ?? value.plan.narration)
        : undefined;
      await window.showme.voice.activity("speaking");
      try {
        for (let index = 0; index < segments.length; index += 1) {
          if (version !== narrationVersion.current) return;
          const prepared = preparedCloud ? await preparedCloud : undefined;
          preparedCloud =
            cloudAvailable && index + 1 < segments.length
              ? prepareCloudSpeech(segments[index + 1] ?? value.plan.narration)
              : undefined;
          setStep(index);
          currentNarration.current = segments[index] || value.plan.narration;
          await waitForWhiteboardPaint(settings.reducedMotion);
          const usedCloud = await speakSegment(
            currentNarration.current,
            settings,
            version,
            controller.signal,
            prepared,
          );
          if (cloudAvailable && !usedCloud) {
            cloudAvailable = false;
            preparedCloud = undefined;
          }
          if (version !== narrationVersion.current) return;
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("Lesson narration stopped unexpectedly.", error);
          await window.showme.voice
            .reportPlaybackError(
              "Narration could not continue after an automatic retry. The visual lesson is still available; check the selected voice and Windows speaker, then try again.",
            )
            .catch((reportError) =>
              console.error("Could not report narration failure.", reportError),
            );
        }
      } finally {
        if (version === narrationVersion.current) {
          currentNarration.current = "";
          if (narrationController.current === controller) narrationController.current = null;
          activeUtterance.current = null;
          await window.showme.voice.activity("idle");
          if (!adapting.current) scheduleBoardRetirement(value, settings);
        }
      }
    },
    [scheduleBoardRetirement, speakSegment, stopPlayback],
  );

  const playVisualTimeline = useCallback(
    async (value: LessonPresentation, settings: AppSettings): Promise<void> => {
      stopPlayback(false);
      const version = ++narrationVersion.current;
      await window.showme.voice.activity("idle");
      const steps = value.plan.steps.length ? value.plan.steps : [undefined];
      for (let index = 0; index < steps.length; index += 1) {
        if (version !== narrationVersion.current) return;
        setStep(index);
        await waitForVisualStep(silentStepDurationMs(steps[index]?.durationMs ?? 1_800));
      }
      if (version === narrationVersion.current && !adapting.current) {
        scheduleBoardRetirement(value, settings);
      }
    },
    [scheduleBoardRetirement, stopPlayback],
  );

  const handleVoiceCommand = useCallback(
    async (event: SpokenLessonCommandEvent): Promise<void> => {
      if (event.confidence < 0.45 || adapting.current) return;
      const command = parseVoiceLessonCommand(event.phrase);
      const activePresentation = presentationRef.current;
      if (!command || !activePresentation) return;
      if (
        command.kind === "adapt" &&
        command.inferredQuestion &&
        isLikelyNarrationEcho(event.phrase, currentNarration.current)
      ) {
        return;
      }
      const settings = bootstrapRef.current?.settings;
      if (command.kind === "clear") {
        stopPlayback(false);
        await window.showme.voice.activity("idle");
        fadeAndCloseBoard(settings?.reducedMotion ?? false, true);
        return;
      }
      if (command.kind === "stop") {
        stopPlayback(false);
        await window.showme.voice.activity("idle");
        if (settings) scheduleBoardRetirement(activePresentation, settings);
        return;
      }
      adapting.current = true;
      activateBoard();
      stopPlayback(false);
      try {
        await window.showme.lesson.adapt({
          presentation: activePresentation,
          adaptation: command.adaptation,
          ...(command.question ? { question: command.question } : {}),
        });
      } catch (error) {
        console.error("Spoken lesson adaptation failed.", error);
        await window.showme.voice.activity("idle");
      } finally {
        adapting.current = false;
      }
    },
    [activateBoard, fadeAndCloseBoard, scheduleBoardRetirement, stopPlayback],
  );

  useEffect(() => {
    document.documentElement.classList.add("whiteboard-document");
    document.body.classList.add("whiteboard-document");
    return () => {
      clearBoardTimers();
      document.documentElement.classList.remove("whiteboard-document");
      document.body.classList.remove("whiteboard-document");
    };
  }, [clearBoardTimers]);

  useEffect(() => {
    void window.showme.app.bootstrap().then((value) => {
      setBootstrap(value);
    });
    const cleanups = [
      window.showme.events.onLessonReady((value) => {
        stopPlayback(false);
        activateBoard();
        presentationRef.current = value;
        pendingAutoplay.current = value.plan.id;
        setPresentation(value);
        setStep(0);
        adapting.current = false;
      }),
      window.showme.events.onSettingsChanged((settings) => {
        setBootstrap((current) => {
          const next = current ? { ...current, settings } : current;
          return next;
        });
      }),
      window.showme.events.onVoiceCommand((event) => void handleVoiceCommand(event)),
    ];
    return () => {
      for (const cleanup of cleanups) cleanup();
      stopPlayback(false);
    };
  }, [activateBoard, handleVoiceCommand, stopPlayback]);

  useEffect(() => {
    if (!presentation || !bootstrap) return;
    if (pendingAutoplay.current !== presentation.plan.id) return;
    pendingAutoplay.current = null;
    if (presentation.request.replyWithVoice && bootstrap.settings.voiceEnabled) {
      void playLesson(presentation, bootstrap.settings);
    } else {
      void playVisualTimeline(presentation, bootstrap.settings);
    }
  }, [bootstrap, playLesson, playVisualTimeline, presentation]);

  useEffect(() => {
    let cancelled = false;
    if (!presentation?.request.allowImageAids || presentation.plan.simulation) {
      setImageAsset(undefined);
      return;
    }
    void window.showme.media
      .search(`${presentation.plan.concept} ${presentation.plan.title}`)
      .then((assets) => {
        if (!cancelled) setImageAsset(assets.find((asset) => asset.thumbnailUrl));
      })
      .catch((error) => console.error("Optional whiteboard image search failed.", error));
    return () => {
      cancelled = true;
    };
  }, [
    presentation?.plan.concept,
    presentation?.plan.simulation,
    presentation?.plan.title,
    presentation?.request.allowImageAids,
  ]);

  if (!presentation) return <main className="whiteboard-overlay" aria-hidden="true" />;
  return (
    <WhiteboardCanvas
      plan={presentation.plan}
      stepIndex={step}
      reducedMotion={bootstrap?.settings.reducedMotion ?? false}
      phase={boardPhase}
      {...(presentation.contextGeometry ? { contextGeometry: presentation.contextGeometry } : {})}
      {...(imageAsset ? { imageAsset } : {})}
    />
  );
}

async function prepareCloudSpeech(text: string): Promise<PreparedCloudSpeech> {
  try {
    return { ok: true, audio: await window.showme.voice.synthesize(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

function waitForWhiteboardPaint(reducedMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (reducedMotion) {
      window.setTimeout(resolve, 20);
      return;
    }
    window.requestAnimationFrame(() => window.setTimeout(resolve, 90));
  });
}

function waitForVisualStep(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
