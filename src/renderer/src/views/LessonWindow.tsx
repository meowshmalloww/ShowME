import { useCallback, useEffect, useRef, useState } from "react";
import { findSystemVoice } from "../../../shared/audio";
import { lessonCheckForStage, nextLearningStage } from "../../../shared/learning-flow";
import { formatLearningCheckPrompt, resolveChoiceIndex } from "../../../shared/learning-check";
import {
  lessonBoardFadeMs,
  lessonBoardHoldMs,
  silentStepDurationMs,
} from "../../../shared/lesson-lifecycle";
import type {
  AppBootstrap,
  AppSettings,
  ImageAsset,
  LearningCheck,
  LearningCheckStage,
  LessonPresentation,
  Point,
  SpokenLessonCommandEvent,
} from "../../../shared/types";
import { isLikelyNarrationEcho, parseVoiceLessonCommand } from "../../../shared/voice-command";
import { routeAudioOutput } from "../audio";
import { WhiteboardCanvas, type WhiteboardLearningCheck } from "../components/WhiteboardCanvas";
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
  const [learningCheck, setLearningCheck] = useState<WhiteboardLearningCheck>();
  const [boardPhase, setBoardPhase] = useState<"active" | "fading">("active");
  const [historyMode, setHistoryMode] = useState<"current" | "context">("context");
  const [pinnedPrimitiveIds, setPinnedPrimitiveIds] = useState<string[]>([]);
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
  const learningCheckRef = useRef<WhiteboardLearningCheck | undefined>(undefined);
  const activeCheckStage = useRef<"diagnostic" | LearningCheckStage | undefined>(undefined);
  const checkSubmitting = useRef(false);
  const stepRef = useRef(0);

  presentationRef.current = presentation;
  bootstrapRef.current = bootstrap;
  learningCheckRef.current = learningCheck;
  stepRef.current = step;

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

  const showLearningCheck = useCallback(
    (value: LessonPresentation, stage: LearningCheckStage): LearningCheck | undefined => {
      const check = lessonCheckForStage(value.plan, stage);
      if (!check) return undefined;
      clearBoardTimers();
      const display: WhiteboardLearningCheck = {
        phase: "awaiting",
        stage,
        prompt: check.prompt,
        ...(check.kind === "multiple-choice" ? { choices: check.choices } : {}),
        ...(check.kind === "point" ? { pointMode: true } : {}),
        ...(check.kind === "point"
          ? {
              message: `Click the target, or say “Show me, my answer is ${check.voiceAnswers[0]}.”`,
            }
          : {}),
        attemptCount: 0,
      };
      activeCheckStage.current = stage;
      learningCheckRef.current = display;
      setLearningCheck(display);
      void window.showme.lesson.setInteractive(check.kind === "point");
      void window.showme.launcher.setMode("waiting");
      return check;
    },
    [clearBoardTimers],
  );

  const showDiagnosticProbe = useCallback((value: LessonPresentation): boolean => {
    const probe = value.plan.diagnosticProbe;
    if (!probe) return false;
    const display: WhiteboardLearningCheck = {
      phase: "awaiting",
      stage: "diagnostic",
      prompt: probe.prompt,
      choices: probe.choices.map((choice) => choice.label),
      message: "Say “Show me, my answer is option A,” or name the part.",
      attemptCount: 0,
    };
    activeCheckStage.current = "diagnostic";
    learningCheckRef.current = display;
    setLearningCheck(display);
    void window.showme.lesson.setInteractive(false);
    void window.showme.launcher.setMode("waiting");
    return true;
  }, []);

  const fadeAndCloseBoard = useCallback(
    (reducedMotion: boolean, userRequested = false): void => {
      clearBoardTimers();
      void window.showme.lesson.setInteractive(false);
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

  const speakStatus = useCallback(
    async (text: string, settings: AppSettings): Promise<void> => {
      if (!settings.voiceEnabled) return;
      stopPlayback(false);
      const version = ++narrationVersion.current;
      const controller = new AbortController();
      narrationController.current = controller;
      currentNarration.current = text;
      await window.showme.voice.activity("speaking");
      try {
        await speakSegment(text, settings, version, controller.signal);
      } catch (error) {
        if (!isAbortError(error)) console.error("Learning-check narration failed.", error);
      } finally {
        if (version === narrationVersion.current) {
          currentNarration.current = "";
          if (narrationController.current === controller) narrationController.current = null;
          await window.showme.voice.activity("idle");
        }
      }
    },
    [speakSegment, stopPlayback],
  );

  const playLesson = useCallback(
    async (value: LessonPresentation, settings: AppSettings, startIndex = 0): Promise<void> => {
      stopPlayback(false);
      const version = ++narrationVersion.current;
      const controller = new AbortController();
      narrationController.current = controller;
      const steps = value.plan.steps.slice(startIndex);
      const segments = steps.length
        ? steps.map((lessonStep) => lessonStep.narration)
        : [value.plan.narration];
      let cloudAvailable = settings.voiceOutputProvider !== "system";
      let preparedCloud = cloudAvailable
        ? prepareCloudSpeech(segments[0] ?? value.plan.narration)
        : undefined;
      let waitingForCheck = false;
      await window.showme.launcher.setMode("teaching");
      await window.showme.voice.activity("speaking");
      try {
        for (let index = 0; index < segments.length; index += 1) {
          if (version !== narrationVersion.current) return;
          const prepared = preparedCloud ? await preparedCloud : undefined;
          preparedCloud =
            cloudAvailable && index + 1 < segments.length
              ? prepareCloudSpeech(segments[index + 1] ?? value.plan.narration)
              : undefined;
          setStep(startIndex + index);
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
        const check = showLearningCheck(value, "try");
        if (check && version === narrationVersion.current) {
          waitingForCheck = true;
          currentNarration.current = formatLearningCheckPrompt(check);
          await waitForWhiteboardPaint(settings.reducedMotion);
          await speakSegment(currentNarration.current, settings, version, controller.signal);
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
          if (waitingForCheck) await window.showme.launcher.setMode("waiting");
          if (!adapting.current && !waitingForCheck) {
            await window.showme.launcher.setMode("complete");
            scheduleBoardRetirement(value, settings);
          }
        }
      }
    },
    [scheduleBoardRetirement, showLearningCheck, speakSegment, stopPlayback],
  );

  const playVisualTimeline = useCallback(
    async (value: LessonPresentation, settings: AppSettings, startIndex = 0): Promise<void> => {
      stopPlayback(false);
      const version = ++narrationVersion.current;
      await window.showme.launcher.setMode("teaching");
      await window.showme.voice.activity("idle");
      const steps = value.plan.steps.length ? value.plan.steps.slice(startIndex) : [undefined];
      for (let index = 0; index < steps.length; index += 1) {
        if (version !== narrationVersion.current) return;
        setStep(startIndex + index);
        await waitForVisualStep(silentStepDurationMs(steps[index]?.durationMs ?? 1_800));
      }
      if (version === narrationVersion.current && !adapting.current) {
        if (!showLearningCheck(value, "try")) {
          await window.showme.launcher.setMode("complete");
          scheduleBoardRetirement(value, settings);
        }
      }
    },
    [scheduleBoardRetirement, showLearningCheck, stopPlayback],
  );

  const submitActiveCheck = useCallback(
    async ({ response, point }: { response?: string; point?: Point }): Promise<void> => {
      const activePresentation = presentationRef.current;
      const settings = bootstrapRef.current?.settings;
      const display = learningCheckRef.current;
      const stage = activeCheckStage.current;
      if (
        !activePresentation ||
        !settings ||
        !display ||
        !stage ||
        display.phase === "correct" ||
        checkSubmitting.current
      ) {
        return;
      }

      if (stage === "diagnostic") {
        checkSubmitting.current = true;
        const probe = activePresentation.plan.diagnosticProbe;
        const choiceIndex = response
          ? resolveChoiceIndex(response, probe?.choices.map((choice) => choice.label) ?? [])
          : undefined;
        const choice = choiceIndex === undefined ? undefined : probe?.choices[choiceIndex];
        if (!choice) {
          const retry: WhiteboardLearningCheck = {
            ...display,
            phase: "retry",
            message: "Name one option, or say option A, B, C, or D.",
          };
          learningCheckRef.current = retry;
          setLearningCheck(retry);
          await speakStatus("I did not catch that choice. Please name one part.", settings);
          await window.showme.launcher.setMode("waiting");
          checkSubmitting.current = false;
          return;
        }
        const focusIndex = Math.max(
          0,
          activePresentation.plan.steps.findIndex((item) => item.id === choice.focusStepId),
        );
        activeCheckStage.current = undefined;
        learningCheckRef.current = undefined;
        setLearningCheck(undefined);
        setStep(focusIndex);
        await window.showme.launcher.setMode("teaching");
        if (activePresentation.request.replyWithVoice && settings.voiceEnabled) {
          await playLesson(activePresentation, settings, focusIndex);
        } else {
          await playVisualTimeline(activePresentation, settings, focusIndex);
        }
        checkSubmitting.current = false;
        return;
      }

      const check = lessonCheckForStage(activePresentation.plan, stage);
      if (!check) return;
      checkSubmitting.current = true;
      activateBoard();
      await window.showme.lesson.setInteractive(false);
      await window.showme.launcher.setMode("checking");
      try {
        const outcome = await window.showme.lesson.submitCheck({
          lessonId: activePresentation.plan.id,
          stage,
          ...(response ? { response } : {}),
          ...(point ? { point } : {}),
        });
        const nextStage = nextLearningStage(activePresentation.plan, stage, outcome.result);
        if (nextStage === "transfer") {
          const transfer = showLearningCheck(activePresentation, "transfer");
          if (transfer) {
            await speakStatus(
              `${outcome.feedback} Now use the same idea on a new example. ${formatLearningCheckPrompt(transfer)}`,
              settings,
            );
            await window.showme.launcher.setMode("waiting");
          }
          checkSubmitting.current = false;
          return;
        }

        const next: WhiteboardLearningCheck = {
          ...display,
          phase: outcome.result === "correct" ? "correct" : "retry",
          attemptCount: outcome.attemptNumber,
          message:
            outcome.result === "correct"
              ? stage === "transfer"
                ? "A separate near-transfer attempt was recorded locally."
                : "A guided Try was recorded locally."
              : "Say “Show me, my answer is …” when you are ready.",
        };
        learningCheckRef.current = next;
        setLearningCheck(next);
        await speakStatus(outcome.feedback, settings);
        if (outcome.result === "correct") {
          await window.showme.launcher.setMode("complete");
          scheduleBoardRetirement(activePresentation, settings);
        } else {
          await window.showme.lesson.setInteractive(check.kind === "point");
          await window.showme.launcher.setMode("waiting");
        }
      } catch (error) {
        console.error("Could not record the learning check.", error);
        await window.showme.lesson.setInteractive(check.kind === "point");
        await window.showme.launcher.setMode("waiting");
      }
      checkSubmitting.current = false;
    },
    [
      activateBoard,
      playLesson,
      playVisualTimeline,
      scheduleBoardRetirement,
      showLearningCheck,
      speakStatus,
    ],
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
        await window.showme.launcher.setMode("complete");
        if (settings) scheduleBoardRetirement(activePresentation, settings);
        return;
      }
      if (command.kind === "go-back") {
        stopPlayback(false);
        await window.showme.lesson.setInteractive(false);
        activeCheckStage.current = undefined;
        learningCheckRef.current = undefined;
        setLearningCheck(undefined);
        setHistoryMode("context");
        const priorIndex = Math.max(0, stepRef.current - 1);
        setStep(priorIndex);
        await window.showme.launcher.setMode("teaching");
        if (settings) {
          const prior = activePresentation.plan.steps[priorIndex];
          if (prior) await speakStatus(prior.narration, settings);
        }
        return;
      }
      if (command.kind === "show-both") {
        activateBoard();
        setHistoryMode("context");
        if (settings) await speakStatus("Showing this step with the previous one.", settings);
        return;
      }
      if (command.kind === "current-only") {
        activateBoard();
        setHistoryMode("current");
        if (settings) {
          await speakStatus("Old marks are hidden. The current step stays visible.", settings);
        }
        return;
      }
      if (command.kind === "keep-formula") {
        activateBoard();
        const currentStepIds = new Set(
          activePresentation.plan.steps[stepRef.current]?.primitiveIds ?? [],
        );
        let formulas = activePresentation.plan.primitives.filter(
          (primitive) => primitive.kind === "equation" && currentStepIds.has(primitive.id),
        );
        if (formulas.length === 0) {
          const priorIds = new Set(
            activePresentation.plan.steps
              .slice(0, stepRef.current + 1)
              .flatMap((lessonStep) => lessonStep.primitiveIds),
          );
          formulas = activePresentation.plan.primitives.filter(
            (primitive) => primitive.kind === "equation" && priorIds.has(primitive.id),
          );
        }
        if (formulas.length > 0) {
          setPinnedPrimitiveIds((current) => [
            ...new Set([...current, ...formulas.map((formula) => formula.id)]),
          ]);
        }
        if (settings) {
          await speakStatus(
            formulas.length > 0
              ? "I will keep the formula on screen."
              : "There is no formula to keep yet.",
            settings,
          );
        }
        return;
      }
      if (command.kind === "answer") {
        await submitActiveCheck({ response: command.response });
        return;
      }
      adapting.current = true;
      activateBoard();
      activeCheckStage.current = undefined;
      learningCheckRef.current = undefined;
      setLearningCheck(undefined);
      await window.showme.lesson.setInteractive(false);
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
    [
      activateBoard,
      fadeAndCloseBoard,
      scheduleBoardRetirement,
      speakStatus,
      stopPlayback,
      submitActiveCheck,
    ],
  );

  useEffect(() => {
    document.documentElement.classList.add("whiteboard-document");
    document.body.classList.add("whiteboard-document");
    return () => {
      clearBoardTimers();
      void window.showme.lesson.setInteractive(false);
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
        setHistoryMode("context");
        setPinnedPrimitiveIds([]);
        activeCheckStage.current = undefined;
        learningCheckRef.current = undefined;
        setLearningCheck(undefined);
        void window.showme.lesson.setInteractive(false);
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
    if (showDiagnosticProbe(presentation)) {
      const probe = presentation.plan.diagnosticProbe;
      if (probe && presentation.request.replyWithVoice && bootstrap.settings.voiceEnabled) {
        void speakStatus(formatDiagnosticPrompt(probe.prompt, probe.choices), bootstrap.settings)
          .then(() => window.showme.launcher.setMode("waiting"))
          .catch((error) => console.error("Diagnostic narration failed.", error));
      }
      return;
    }
    if (presentation.request.replyWithVoice && bootstrap.settings.voiceEnabled) {
      void playLesson(presentation, bootstrap.settings);
    } else {
      void playVisualTimeline(presentation, bootstrap.settings);
    }
  }, [bootstrap, playLesson, playVisualTimeline, presentation, showDiagnosticProbe, speakStatus]);

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
      historyMode={historyMode}
      pinnedPrimitiveIds={pinnedPrimitiveIds}
      onPointAnswer={(point) => void submitActiveCheck({ point })}
      {...(learningCheck ? { learningCheck } : {})}
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

function formatDiagnosticPrompt(prompt: string, choices: { label: string }[]): string {
  return `${prompt} ${choices
    .map((choice, index) => `${String.fromCharCode(65 + index)}, ${choice.label}`)
    .join(". ")}.`;
}
