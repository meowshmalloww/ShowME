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
          <span className="eyebrow">Workspace</span>
          <h1>Turn what you see into something you can explore.</h1>
          <p>
            Select any part of your screen. ShowME builds a focused lesson with steps, controls, and
            sources.
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
          <span className="mothership-step" aria-hidden="true">
            <Crosshair size={24} />
          </span>
          <div>
            <span className="eyebrow">Start here</span>
            <h2>Select a region of your screen</h2>
            <p>
              Mark the exact diagram, paragraph, interface, or problem you want to understand, then
              ask by text or voice.
            </p>
          </div>
        </div>
        <div className="mothership-actions">
          <button type="button" className="primary-action" onClick={onNew}>
            <Crosshair size={18} /> Select from screen
          </button>
          <kbd>
            <Command size={14} /> {shortcut}
          </kbd>
        </div>
        <div className="mothership-trust">
          <span>
            <ShieldCheck size={15} /> Nothing is captured in the background
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
              <strong>No saved lessons yet.</strong> Lessons you keep will appear here.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
