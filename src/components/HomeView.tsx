import {
  ArrowRight,
  Command,
  History,
  MessageSquareText,
  MousePointer2,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { AppBootstrap, LessonReceipt, StoredLesson } from "../lib/types";
import { ProviderGlyph } from "./Chrome";

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
    bootstrap.platform === "macos" ? "Cmd" : "Ctrl",
  );

  return (
    <div className="home-page">
      <header className="workspace-header">
        <div>
          <span className="section-kicker">Workspace</span>
          <h1>Make the hard part visible.</h1>
          <p>
            Select something confusing. Ask once. Explore the answer instead of reading a wall of
            text.
          </p>
        </div>
        <button type="button" className="provider-status" onClick={onSettings}>
          {provider && <ProviderGlyph provider={provider.id} size={19} />}
          <span>
            <small>{provider?.configured ? "Connected" : "Setup needed"}</small>
            <strong>{provider?.configured ? provider.name : "Connect a model"}</strong>
          </span>
          <ArrowRight size={15} />
        </button>
      </header>

      <section className="capture-start-card">
        <div className="capture-start-copy">
          <span className="capture-start-icon" aria-hidden="true">
            <ScanLine size={23} />
          </span>
          <div>
            <span className="section-kicker">New lesson</span>
            <h2>Choose exactly what you want to understand</h2>
            <p>
              Capture one diagram, paragraph, equation, interface, or problem. ShowME sends only the
              area you approve.
            </p>
            <div className="capture-start-actions">
              <button type="button" className="primary-action" onClick={onNew}>
                <ScanLine size={17} /> Select from screen
              </button>
              <kbd>
                <Command size={13} /> {shortcut}
              </kbd>
            </div>
          </div>
        </div>
        <div className="capture-demo" aria-hidden="true">
          <div className="capture-demo-window">
            <span className="capture-demo-line long" />
            <span className="capture-demo-line" />
            <span className="capture-demo-line short" />
            <div className="capture-demo-selection">
              <span>selected area</span>
            </div>
            <MousePointer2 className="capture-demo-cursor" size={20} />
          </div>
        </div>
        <ol className="workflow-rail" aria-label="How ShowME works">
          <li>
            <span>
              <MousePointer2 size={15} />
            </span>
            <div>
              <strong>Select</strong>
              <small>Mark the source</small>
            </div>
          </li>
          <li>
            <span>
              <MessageSquareText size={15} />
            </span>
            <div>
              <strong>Ask</strong>
              <small>Type or speak</small>
            </div>
          </li>
          <li>
            <span>
              <SlidersHorizontal size={15} />
            </span>
            <div>
              <strong>Explore</strong>
              <small>Change the variables</small>
            </div>
          </li>
        </ol>
        <div className="capture-privacy-note">
          <ShieldCheck size={15} /> Capture is off until you start it. No background screenshots.
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Saved locally</span>
            <h2>Recent lessons</h2>
          </div>
          <History size={18} />
        </div>
        {bootstrap.recentLessons.length ? (
          <div className="recent-list">
            {bootstrap.recentLessons.slice(0, 4).map((lesson) => (
              <button type="button" key={lesson.id} onClick={() => onOpenRecent(lesson)}>
                <span className="lesson-mark">
                  <ScanLine size={15} />
                </span>
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
          <div className="recent-empty">
            <History size={19} />
            <span>
              <strong>Your first lesson will appear here.</strong> Start with anything already on
              your screen.
            </span>
            <button type="button" onClick={onNew}>
              Create a lesson <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
