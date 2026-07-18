import {
  ArrowUpRight,
  Check,
  Circle,
  Focus,
  Lasso,
  MapPin,
  MousePointer2,
  Redo2,
  Square,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import { commandErrorMessage } from "../lib/errors";
import type { CapturePayload, Point, SelectionRegion } from "../lib/types";
import { Spinner } from "./Chrome";

type Tool = SelectionRegion["kind"];

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "rectangle", label: "Rectangle", icon: <Square size={17} /> },
  { id: "lasso", label: "Lasso", icon: <Lasso size={17} /> },
  { id: "point", label: "Point", icon: <MapPin size={17} /> },
  { id: "circle", label: "Circle", icon: <Circle size={17} /> },
  { id: "arrow", label: "Arrow", icon: <ArrowUpRight size={17} /> },
  { id: "line", label: "Line", icon: <Redo2 size={17} /> },
  { id: "label", label: "Label", icon: <Tag size={17} /> },
];

function normalizedPoint(event: React.PointerEvent<SVGSVGElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
    y: Math.max(0, Math.min(1000, ((event.clientY - bounds.top) / bounds.height) * 1000)),
  };
}

function RegionShape({ region, active = false }: { region: SelectionRegion; active?: boolean }) {
  const start = region.points[0];
  const end = region.points.at(-1) ?? start;
  if (!start || !end) return null;
  const className = `selection-shape ${active ? "active" : ""}`;
  if (region.kind === "rectangle") {
    return (
      <rect
        className={className}
        x={Math.min(start.x, end.x)}
        y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)}
        height={Math.abs(end.y - start.y)}
        rx="8"
      />
    );
  }
  if (region.kind === "lasso") {
    return (
      <polyline
        className={className}
        points={region.points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
    );
  }
  if (region.kind === "point") {
    return (
      <g className={className}>
        <circle cx={start.x} cy={start.y} r="18" />
        <circle cx={start.x} cy={start.y} r="4" className="selection-dot" />
      </g>
    );
  }
  if (region.kind === "circle") {
    return (
      <circle
        className={className}
        cx={start.x}
        cy={start.y}
        r={Math.hypot(end.x - start.x, end.y - start.y)}
      />
    );
  }
  if (region.kind === "label") {
    return (
      <g className={className}>
        <circle cx={start.x} cy={start.y} r="7" />
        <text x={start.x + 15} y={start.y - 15}>
          {region.label || "Focus"}
        </text>
      </g>
    );
  }
  return (
    <line
      className={className}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      markerEnd={region.kind === "arrow" ? "url(#selection-arrow)" : undefined}
    />
  );
}

export function CaptureOverlay() {
  const [capture, setCapture] = useState<CapturePayload>();
  const [tool, setTool] = useState<Tool>("rectangle");
  const [regions, setRegions] = useState<SelectionRegion[]>([]);
  const [draft, setDraft] = useState<SelectionRegion>();
  const [label, setLabel] = useState("Focus here");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    document.body.classList.add("capture-root");
    const load = async () => {
      try {
        if (isTauriRuntime()) {
          setCapture(await desktop.pendingCapture());
        } else {
          throw new Error("Screen selection requires the native desktop application.");
        }
      } catch (value) {
        setError(commandErrorMessage(value));
      }
    };
    load();
    return () => document.body.classList.remove("capture-root");
  }, []);

  const cancel = useCallback(async () => {
    if (isTauriRuntime()) await desktop.cancelCapture();
    else window.history.back();
  }, []);

  const commit = useCallback(async () => {
    if (!capture || regions.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      if (!isTauriRuntime()) {
        throw new Error("Screen selection requires the native desktop application.");
      }
      await desktop.commitSelection(capture.captureId, regions);
    } catch (value) {
      setError(commandErrorMessage(value));
      setSaving(false);
    }
  }, [capture, regions]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
      if (event.key === "Enter" && regions.length > 0) commit();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setRegions((items) => items.slice(0, -1));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [cancel, commit, regions.length]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!capture || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = normalizedPoint(event);
    const id = `region-${Date.now()}-${++sequence.current}`;
    const next: SelectionRegion = {
      id,
      kind: tool,
      points: tool === "point" || tool === "label" ? [point] : [point, point],
      label: tool === "label" ? label.trim() || "Focus here" : undefined,
    };
    if (tool === "point" || tool === "label") setRegions((items) => [...items, next]);
    else setDraft(next);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draft) return;
    const point = normalizedPoint(event);
    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "lasso") {
        const last = current.points.at(-1);
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < 4) return current;
        return { ...current, points: [...current.points, point] };
      }
      const first = current.points[0];
      return first ? { ...current, points: [first, point] } : current;
    });
  };

  const onPointerUp = () => {
    if (!draft) return;
    const [first, last] = [draft.points[0], draft.points.at(-1)];
    if (
      first &&
      last &&
      (draft.kind === "lasso" || Math.hypot(last.x - first.x, last.y - first.y) > 5)
    ) {
      setRegions((items) => [...items, draft]);
    }
    setDraft(undefined);
  };

  if (!capture) {
    return (
      <main className="capture-loading">
        {error ? (
          <div className="capture-error">
            <Focus size={28} />
            <p>{error}</p>
            <button type="button" onClick={cancel}>
              Close
            </button>
          </div>
        ) : (
          <Spinner label="Preparing a private screen snapshot…" />
        )}
      </main>
    );
  }

  return (
    <main className="capture-overlay">
      <img src={capture.imageDataUrl} alt="Current screen snapshot" draggable={false} />
      <div className="capture-dim" />
      <svg
        className="capture-canvas"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(undefined)}
        aria-label="Screen region selection surface"
      >
        <defs>
          <marker
            id="selection-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" className="selection-arrowhead" />
          </marker>
        </defs>
        {regions.map((region) => (
          <RegionShape key={region.id} region={region} />
        ))}
        {draft && <RegionShape region={draft} active />}
      </svg>

      <section className="capture-toolbar" aria-label="Selection tools">
        <div className="capture-tool-group">
          {TOOLS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={tool === item.id ? "active" : ""}
              aria-label={item.label}
              title={item.label}
              onClick={() => setTool(item.id)}
            >
              {item.icon}
            </button>
          ))}
        </div>
        {tool === "label" && (
          <input
            value={label}
            maxLength={80}
            onChange={(event) => setLabel(event.target.value)}
            aria-label="Annotation label"
          />
        )}
        <span className="capture-divider" />
        <button
          type="button"
          onClick={() => setRegions((items) => items.slice(0, -1))}
          disabled={regions.length === 0}
          title="Undo"
        >
          <MousePointer2 size={17} />
        </button>
        <button
          type="button"
          onClick={() => setRegions([])}
          disabled={regions.length === 0}
          title="Clear"
        >
          <Trash2 size={17} />
        </button>
        <button className="capture-cancel" type="button" onClick={cancel}>
          <X size={16} /> Cancel
        </button>
        <button
          className="capture-commit"
          type="button"
          onClick={commit}
          disabled={regions.length === 0 || saving}
        >
          {saving ? (
            <Spinner label="Use selection" />
          ) : (
            <>
              <Check size={17} /> Use selection
            </>
          )}
        </button>
      </section>
      <div className="capture-hint">
        <strong>
          {regions.length
            ? `${regions.length} mark${regions.length === 1 ? "" : "s"} selected`
            : "Draw around what you want to understand"}
        </strong>
        <span>
          Shift your attention, not your data. This snapshot stays in memory for this lesson.
        </span>
      </div>
      {error && <div className="capture-toast">{error}</div>}
    </main>
  );
}
