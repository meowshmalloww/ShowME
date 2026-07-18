import { BookOpen, Crosshair, ExternalLink, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import { commandErrorMessage } from "../lib/errors";
import type { LessonReceipt, StoredLesson } from "../lib/types";
import { EmptyState, Spinner } from "./Chrome";

export function HistoryView({
  lessons,
  onOpen,
  onNew,
  onDeleted,
}: {
  lessons: LessonReceipt[];
  onOpen: (lesson: StoredLesson) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? lessons.filter((item) =>
          `${item.title} ${item.concept} ${item.question}`.toLowerCase().includes(needle),
        )
      : lessons;
  }, [lessons, query]);

  const open = async (receipt: LessonReceipt) => {
    setLoading(receipt.id);
    setError(undefined);
    try {
      if (isTauriRuntime()) onOpen(await desktop.getLesson(receipt.id));
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setLoading(undefined);
    }
  };

  const remove = async (receipt: LessonReceipt) => {
    setLoading(receipt.id);
    setError(undefined);
    try {
      if (isTauriRuntime()) await desktop.deleteLesson(receipt.id);
      onDeleted(receipt.id);
    } catch (value) {
      setError(commandErrorMessage(value));
    } finally {
      setLoading(undefined);
    }
  };

  return (
    <div className="history-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Local memory</span>
          <h1>Your visual lessons</h1>
          <p>Search, reopen, or erase any lesson saved on this device.</p>
        </div>
        <label className="history-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons…"
          />
        </label>
      </header>
      {error && <div className="form-error">{error}</div>}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title={lessons.length ? "Nothing matches that search" : "No saved lessons yet"}
          action={
            lessons.length ? (
              <button className="empty-secondary-action" type="button" onClick={() => setQuery("")}>
                Clear search
              </button>
            ) : (
              <button className="primary-action" type="button" onClick={onNew}>
                <Crosshair size={16} /> Capture region
              </button>
            )
          }
        >
          {lessons.length
            ? "Try a broader concept or question."
            : "When local memory is enabled, generated plans appear here. Screenshots never do."}
        </EmptyState>
      ) : (
        <div className="history-list">
          {filtered.map((lesson) => (
            <article key={lesson.id}>
              <button
                type="button"
                className="history-open"
                onClick={() => open(lesson)}
                disabled={Boolean(loading)}
              >
                <span className={`history-confidence ${lesson.confidence}`}>
                  <BookOpen size={18} />
                </span>
                <div>
                  <span className="history-meta">
                    {new Date(lesson.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {lesson.provider} · {lesson.citationCount} source
                    {lesson.citationCount === 1 ? "" : "s"}
                  </span>
                  <h2>{lesson.title}</h2>
                  <p>{lesson.question}</p>
                  <small>
                    {lesson.concept} · {lesson.sourceDescription}
                  </small>
                </div>
                {loading === lesson.id ? <Spinner label="Opening" /> : <ExternalLink size={18} />}
              </button>
              <button
                type="button"
                className="history-delete"
                onClick={() => remove(lesson)}
                aria-label={`Delete ${lesson.title}`}
                disabled={Boolean(loading)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
