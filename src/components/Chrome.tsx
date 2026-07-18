import { Archive, Crosshair, LayoutDashboard, Minus, Settings, X } from "lucide-react";
import type { ReactNode } from "react";
import { desktop, isTauriRuntime } from "../lib/api";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <title>ShowME</title>
          <path d="M9 20c0-9 6-15 15-15s15 6 15 15v12c0 7-6 11-15 11S9 39 9 32V20Z" />
          <path className="brand-mark-face" d="M16 26c2 2 4 3 8 3s6-1 8-3" />
          <circle className="brand-mark-eye" cx="18" cy="20" r="2" />
          <circle className="brand-mark-eye" cx="30" cy="20" r="2" />
          <path
            className="brand-mark-spark"
            d="m38 7 1.5 4.5L44 13l-4.5 1.5L38 19l-1.5-4.5L32 13l4.5-1.5L38 7Z"
          />
        </svg>
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>ShowME</strong>
          <small>visual workbench</small>
        </span>
      )}
    </div>
  );
}

export function Titlebar({ preview = false }: { preview?: boolean }) {
  const action = async (value: "minimize" | "hide") => {
    if (isTauriRuntime()) await desktop.windowAction(value);
  };
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <Brand compact />
        <span data-tauri-drag-region>ShowME</span>
        {preview && <span className="preview-pill">Preview</span>}
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="window-actions">
        <button type="button" aria-label="Minimize" onClick={() => action("minimize")}>
          <Minus size={16} />
        </button>
        <button type="button" aria-label="Hide ShowME" onClick={() => action("hide")}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}

export type MainSection = "learn" | "history" | "settings";

export function Sidebar({
  section,
  onSection,
  onNew,
}: {
  section: MainSection;
  onSection: (section: MainSection) => void;
  onNew: () => void;
}) {
  const links: { id: MainSection; label: string; icon: ReactNode }[] = [
    { id: "learn", label: "Workspace", icon: <LayoutDashboard size={18} /> },
    { id: "history", label: "Library", icon: <Archive size={18} /> },
    { id: "settings", label: "Settings", icon: <Settings size={19} /> },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Brand />
      </div>
      <button className="new-lesson-button" type="button" onClick={onNew}>
        <Crosshair size={18} />
        Capture region
      </button>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <button
            className={section === link.id ? "active" : ""}
            type="button"
            key={link.id}
            onClick={() => onSection(link.id)}
            aria-current={section === link.id ? "page" : undefined}
          >
            {link.icon}
            {link.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-promise">
        <span className="privacy-dot" />
        <div>
          <strong>Capture idle</strong>
          <span>Starts only when invoked</span>
        </div>
      </div>
    </aside>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`toggle-row ${disabled ? "disabled" : ""}`}>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

export function Spinner({ label = "Working" }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
