import { AlertCircle, Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { formatCommandError } from "../../../shared/errors";

export function Spinner({ small = false }: { small?: boolean }) {
  return <span className={small ? "spinner spinner-small" : "spinner"} aria-hidden="true" />;
}

export function Toggle({
  checked,
  onChange,
  label,
  note,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  note?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {note ? <small>{note}</small> : null}
      </span>
      <input
        aria-label={label}
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        role="switch"
        type="checkbox"
      />
      <span className="toggle-track">
        <span />
      </span>
    </label>
  );
}

export function Toast({
  message,
  tone = "error",
  onClose,
}: {
  message: string;
  tone?: "error" | "success" | "info";
  onClose: () => void;
}) {
  return (
    <div className={"toast " + tone} role="status">
      {tone === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
      <span>{message}</span>
      <button aria-label="Dismiss" onClick={onClose} type="button">
        <X size={15} />
      </button>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const remediation = (error as Error & { remediation?: string }).remediation;
  return formatCommandError({
    message: error.message,
    ...(remediation ? { remediation } : {}),
  });
}
