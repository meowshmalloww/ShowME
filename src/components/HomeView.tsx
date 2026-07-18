import { ArrowRight, Command, Crosshair, History, KeyRound, Mic, ShieldCheck } from "lucide-react";
import type { AppBootstrap, LessonReceipt, StoredLesson } from "../lib/types";

export function HomeView({
  bootstrap,
  onNew,
  onSettings,
  onOpenRecent,
}: {
  bootstrap: AppBootstrap;
  onNew: () => void;
  onSettings: () => void;
  onOpenRecent: (receipt: LessonReceipt) => Promise<StoredLesson | undefined>;
}) {
  const provider = bootstrap.providers.find((item) => item.id === bootstrap.settings.provider);
  const shortcut = bootstrap.settings.hotkey.replace(
    "CommandOrControl",
    bootstrap.platform === "macos" ? "⌘" : "Ctrl",
  );

  return (
    <div className="home-page mothership-home">
      <header className="mothership-heading">
        <div>
          <span className="eyebrow">ShowME mothership</span>
          <h1>Ready when something is unclear.</h1>
          <p>
            Most work starts from the floating pet. This window holds setup, lesson history, and the
            finished visual lesson.
          </p>
        </div>
        <button type="button" className="connection-card" onClick={onSettings}>
          <span className={`status-led ${provider?.configured ? "ready" : ""}`} />
          <span>
            <small>Lesson provider</small>
            <strong>{provider?.configured ? provider.name : "API key required"}</strong>
          </span>
          <KeyRound size={17} />
        </button>
      </header>

      <section className="mothership-start">
        <div className="mothership-copy">
          <span className="mothership-step">1</span>
          <div>
            <h2>Select the confusing part.</h2>
            <p>
              Capture one or more regions, then ask by microphone or text beside the pet. ShowME
              opens this window only when the visual lesson is ready.
            </p>
          </div>
        </div>
        <div className="mothership-actions">
          <button type="button" className="primary-action" onClick={onNew}>
            <Crosshair size={18} /> Capture screen area
          </button>
          <kbd>
            <Command size={14} /> {shortcut}
          </kbd>
        </div>
        <div className="mothership-trust">
          <span>
            <ShieldCheck size={15} /> Captures only when invoked
          </span>
          <span>
            <Mic size={15} /> Microphone only while pressed
          </span>
        </div>
      </section>

      <section className="mothership-recent">
        <div className="compact-section-heading">
          <div>
            <span className="eyebrow">On this device</span>
            <h2>Recent lessons</h2>
          </div>
          <History size={18} />
        </div>
        {bootstrap.recentLessons.length ? (
          <div className="mothership-lesson-list">
            {bootstrap.recentLessons.slice(0, 4).map((lesson) => (
              <button type="button" key={lesson.id} onClick={() => onOpenRecent(lesson)}>
                <span className={`activity-dot ${lesson.confidence}`} />
                <span>
                  <strong>{lesson.title}</strong>
                  <small>
                    {lesson.concept} · {new Date(lesson.createdAt).toLocaleDateString()}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="mothership-empty">
            <History size={20} />
            <span>
              <strong>No lessons yet.</strong> Your first real generated lesson will appear here.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
