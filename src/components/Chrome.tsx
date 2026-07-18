import SiAlibabacloud from "@icons-pack/react-simple-icons/icons/SiAlibabacloud.mjs";
import SiNvidia from "@icons-pack/react-simple-icons/icons/SiNvidia.mjs";
import SiOpenrouter from "@icons-pack/react-simple-icons/icons/SiOpenrouter.mjs";
import {
  Archive,
  Cpu,
  Gauge,
  LayoutDashboard,
  Minus,
  ScanLine,
  Settings,
  ShieldCheck,
  Waypoints,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import type { ProviderId } from "../lib/types";

export function BrandGlyph() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path className="brand-glyph-frame" d="M15 8H8v7m17-7h7v7m0 10v7h-7M15 32H8v-7" />
      <path className="brand-glyph-line" d="M14 20h12M20 14v12" />
    </svg>
  );
}

export function ProviderGlyph({ provider, size = 18 }: { provider: ProviderId; size?: number }) {
  const common = { size, "aria-hidden": true } as const;
  if (provider === "alibaba") return <SiAlibabacloud {...common} />;
  if (provider === "nvidia") return <SiNvidia {...common} />;
  if (provider === "openrouter") return <SiOpenrouter {...common} />;
  if (provider === "groq") return <Gauge {...common} strokeWidth={1.8} />;
  if (provider === "cerebras") return <Cpu {...common} strokeWidth={1.8} />;
  return <Waypoints {...common} strokeWidth={1.8} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <BrandGlyph />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>ShowME</strong>
          <small>visual lessons</small>
        </span>
      )}
    </div>
  );
}

export function Titlebar() {
  const action = async (value: "minimize" | "hide") => {
    if (isTauriRuntime()) await desktop.windowAction(value);
  };
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <Brand compact />
        <span data-tauri-drag-region>ShowME</span>
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
      <button className="new-lesson-button" type="button" onClick={onNew}>
        <ScanLine size={18} />
        New capture
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
        <ShieldCheck size={17} />
        <div>
          <strong>Capture on request</strong>
          <span>No background screenshots</span>
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
