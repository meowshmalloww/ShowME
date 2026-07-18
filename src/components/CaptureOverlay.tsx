import {
  ArrowUpRight,
  Check,
  Circle,
  Focus,
  Lasso,
  MapPin,
  Minus,
  Square,
  Tag,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { desktop, isTauriRuntime } from "../lib/api";
import {
  arrowGeometry,
  normalizedToClient,
  snapNormalizedPoint,
  squareNormalizedPoint,
} from "../lib/coordinates";
import { commandErrorMessage } from "../lib/errors";
import type { CapturePayload, Point, SelectionRegion } from "../lib/types";
import { Spinner } from "./Chrome";

type Tool = SelectionRegion["kind"];
type CanvasSize = { width: number; height: number };
type RegionInteraction =
  | { kind: "move"; regionId: string; start: Point; original: Point[] }
  | { kind: "resize"; regionId: string; pointIndex: number; original: Point[] };

const TOOLS: { id: Tool; label: string; shortcut: string; icon: React.ReactNode }[] = [
  { id: "rectangle", label: "Area", shortcut: "R", icon: <Square size={17} /> },
  { id: "lasso", label: "Lasso", shortcut: "L", icon: <Lasso size={17} /> },
  { id: "point", label: "Point", shortcut: "P", icon: <MapPin size={17} /> },
  { id: "circle", label: "Circle", shortcut: "C", icon: <Circle size={17} /> },
  { id: "arrow", label: "Arrow", shortcut: "A", icon: <ArrowUpRight size={17} /> },
  { id: "line", label: "Line", shortcut: "D", icon: <Minus size={17} /> },
  { id: "label", label: "Note", shortcut: "T", icon: <Tag size={17} /> },
];

function normalizedPoint(event: React.PointerEvent<SVGSVGElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
    y: Math.max(0, Math.min(1000, ((event.clientY - bounds.top) / bounds.height) * 1000)),
  };
}

function canvasPoint(point: Point, size: CanvasSize): Point {
  return normalizedToClient(point, size.width, size.height);
}

function lineAngle(start: Point, end: Point): number {
  const angle = (Math.atan2(-(end.y - start.y), end.x - start.x) * 180) / Math.PI;
  return Math.round((angle + 360) % 360);
}

function RegionMask({ region, size }: { region: SelectionRegion; size: CanvasSize }) {
  const startRaw = region.points[0];
  const endRaw = region.points.at(-1) ?? startRaw;
  if (!startRaw || !endRaw) return null;
  const start = canvasPoint(startRaw, size);
  const end = canvasPoint(endRaw, size);
  if (region.kind === "rectangle") {
    return (
      <rect
        x={Math.min(start.x, end.x)}
        y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)}
        height={Math.abs(end.y - start.y)}
        rx="2"
        fill="black"
      />
    );
  }
  if (region.kind === "lasso") {
    return (
      <polygon
        points={region.points
          .map((point) => canvasPoint(point, size))
          .map((point) => `${point.x},${point.y}`)
          .join(" ")}
        fill="black"
      />
    );
  }
  if (region.kind === "circle") {
    return (
      <circle
        cx={start.x}
        cy={start.y}
        r={Math.hypot(end.x - start.x, end.y - start.y)}
        fill="black"
      />
    );
  }
  if (region.kind === "point" || region.kind === "label") {
    return <circle cx={start.x} cy={start.y} r="34" fill="black" />;
  }
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="black"
      strokeWidth="30"
      strokeLinecap="round"
    />
  );
}

function RegionShape({
  region,
  size,
  active = false,
  selected = false,
}: {
  region: SelectionRegion;
  size: CanvasSize;
  active?: boolean;
  selected?: boolean;
}) {
  const startRaw = region.points[0];
  const endRaw = region.points.at(-1) ?? startRaw;
  if (!startRaw || !endRaw) return null;
  const start = canvasPoint(startRaw, size);
  const end = canvasPoint(endRaw, size);
  const className = `selection-shape ${active ? "active" : ""} ${selected ? "selected" : ""}`;
  let shape: React.ReactNode;

  if (region.kind === "rectangle") {
    shape = (
      <rect
        x={Math.min(start.x, end.x)}
        y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)}
        height={Math.abs(end.y - start.y)}
        rx="2"
      />
    );
  } else if (region.kind === "lasso") {
    shape = (
      <polygon
        points={region.points
          .map((point) => canvasPoint(point, size))
          .map((point) => `${point.x},${point.y}`)
          .join(" ")}
      />
    );
  } else if (region.kind === "point") {
    shape = (
      <>
        <circle cx={start.x} cy={start.y} r="15" />
        <circle cx={start.x} cy={start.y} r="4" className="selection-dot" />
      </>
    );
  } else if (region.kind === "circle") {
    shape = <circle cx={start.x} cy={start.y} r={Math.hypot(end.x - start.x, end.y - start.y)} />;
  } else if (region.kind === "label") {
    shape = (
      <>
        <circle cx={start.x} cy={start.y} r="6" />
        <rect x={start.x + 12} y={start.y - 27} width="116" height="25" rx="4" />
        <text x={start.x + 21} y={start.y - 10}>
          {region.label || "Focus here"}
        </text>
      </>
    );
  } else if (region.kind === "arrow") {
    const geometry = arrowGeometry(start, end, 3);
    if (!geometry) return null;
    shape = (
      <>
        <line className="selection-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        <line x1={start.x} y1={start.y} x2={geometry.shaftEnd.x} y2={geometry.shaftEnd.y} />
        <path
          className="selection-arrowhead"
          d={`M ${end.x} ${end.y} L ${geometry.left.x} ${geometry.left.y} L ${geometry.right.x} ${geometry.right.y} Z`}
        />
        {active && (
          <text className="selection-angle" x={end.x + 12} y={end.y - 12}>
            {lineAngle(start, end)}°
          </text>
        )}
      </>
    );
  } else {
    shape = (
      <>
        <line className="selection-hit" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
        {active && (
          <text className="selection-angle" x={end.x + 12} y={end.y - 12}>
            {lineAngle(start, end)}°
          </text>
        )}
      </>
    );
  }

  const handleIndexes = region.points.length > 1 ? [0, region.points.length - 1] : [0];
  return (
    <g className={className} data-region-id={region.id}>
      {shape}
      {selected &&
        [...new Set(handleIndexes)].map((index) => {
          const rawPoint = region.points[index];
          if (!rawPoint) return null;
          const point = canvasPoint(rawPoint, size);
          return (
            <circle
              className="selection-handle"
              cx={point.x}
              cy={point.y}
              r="5"
              data-handle-index={index}
              key={index}
            />
          );
        })}
    </g>
  );
}

export function moveSelectionPoints(original: Point[], start: Point, current: Point): Point[] {
  const minX = Math.min(...original.map((point) => point.x));
  const maxX = Math.max(...original.map((point) => point.x));
  const minY = Math.min(...original.map((point) => point.y));
  const maxY = Math.max(...original.map((point) => point.y));
  const dx = Math.max(-minX, Math.min(1000 - maxX, current.x - start.x));
  const dy = Math.max(-minY, Math.min(1000 - maxY, current.y - start.y));
  return original.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function CaptureOverlay() {
  const [capture, setCapture] = useState<CapturePayload>();
  const [armed, setArmed] = useState(false);
  const [tool, setTool] = useState<Tool>("rectangle");
  const [regions, setRegions] = useState<SelectionRegion[]>([]);
  const [draft, setDraft] = useState<SelectionRegion>();
  const [selectedRegionId, setSelectedRegionId] = useState<string>();
  const [interaction, setInteraction] = useState<RegionInteraction>();
  const [label, setLabel] = useState("Focus here");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1 });
  const canvasRef = useRef<SVGSVGElement>(null);
  const sequence = useRef(0);

  useEffect(() => {
    document.body.classList.add("capture-root");
    let armTimer: number | undefined;
    const load = async () => {
      try {
        if (!isTauriRuntime()) {
          throw new Error("Screen selection requires the native desktop application.");
        }
        setCapture(await desktop.pendingCapture());
        armTimer = window.setTimeout(() => setArmed(true), 350);
      } catch (value) {
        setError(commandErrorMessage(value));
      }
    };
    void load();
    return () => {
      document.body.classList.remove("capture-root");
      if (armTimer) window.clearTimeout(armTimer);
    };
  }, []);

  useLayoutEffect(() => {
    if (!capture) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const bounds = canvas.getBoundingClientRect();
      setCanvasSize({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [capture]);

  const cancel = useCallback(async () => {
    if (isTauriRuntime()) await desktop.cancelCapture();
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
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Escape") void cancel();
      if (event.key === "Enter" && regions.length > 0 && !typing) void commit();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedRegionId && !typing) {
        event.preventDefault();
        setRegions((items) => items.filter((item) => item.id !== selectedRegionId));
        setSelectedRegionId(undefined);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setRegions((items) => items.slice(0, -1));
        setSelectedRegionId(undefined);
      }
      if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = event.key.toUpperCase();
        const selected = TOOLS.find((item) => item.shortcut === shortcut);
        if (selected) setTool(selected.id);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [cancel, commit, regions.length, selectedRegionId]);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!capture || !armed || saving || event.button !== 0) return;
    const point = normalizedPoint(event);
    const target = event.target as Element;
    const regionElement = target.closest<SVGGElement>("[data-region-id]");
    const regionId = regionElement?.dataset.regionId;

    if (regionId) {
      const region = regions.find((item) => item.id === regionId);
      if (!region) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedRegionId(regionId);
      const handle = target.closest<SVGCircleElement>("[data-handle-index]");
      const pointIndex = handle?.dataset.handleIndex;
      setInteraction(
        pointIndex === undefined
          ? { kind: "move", regionId, start: point, original: region.points }
          : {
              kind: "resize",
              regionId,
              pointIndex: Number(pointIndex),
              original: region.points,
            },
      );
      return;
    }

    setSelectedRegionId(undefined);
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: SelectionRegion = {
      id: `region-${Date.now()}-${++sequence.current}`,
      kind: tool,
      points: tool === "point" || tool === "label" ? [point] : [point, point],
      label: tool === "label" ? label.trim() || "Focus here" : undefined,
    };
    if (tool === "point" || tool === "label") {
      setRegions((items) => [...items, next]);
      setSelectedRegionId(next.id);
    } else {
      setDraft(next);
    }
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = normalizedPoint(event);
    if (interaction) {
      setRegions((items) =>
        items.map((region) => {
          if (region.id !== interaction.regionId) return region;
          if (interaction.kind === "move") {
            return {
              ...region,
              points: moveSelectionPoints(interaction.original, interaction.start, point),
            };
          }
          const points = [...interaction.original];
          points[interaction.pointIndex] = point;
          return { ...region, points };
        }),
      );
      return;
    }
    if (!draft) return;
    const shiftKey = event.shiftKey;
    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "lasso") {
        const last = current.points.at(-1);
        const lastClient = last
          ? normalizedToClient(last, canvasSize.width, canvasSize.height)
          : null;
        const pointClient = normalizedToClient(point, canvasSize.width, canvasSize.height);
        if (
          lastClient &&
          Math.hypot(pointClient.x - lastClient.x, pointClient.y - lastClient.y) < 3
        ) {
          return current;
        }
        return { ...current, points: [...current.points, point] };
      }
      const first = current.points[0];
      if (!first) return current;
      let end = point;
      if (shiftKey && (current.kind === "line" || current.kind === "arrow")) {
        end = snapNormalizedPoint(first, point, canvasSize.width, canvasSize.height);
      } else if (shiftKey && current.kind === "rectangle") {
        end = squareNormalizedPoint(first, point, canvasSize.width, canvasSize.height);
      }
      return { ...current, points: [first, end] };
    });
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (interaction) {
      setInteraction(undefined);
      return;
    }
    if (!draft) return;
    const first = draft.points[0];
    const last = draft.points.at(-1);
    if (first && last) {
      const firstClient = normalizedToClient(first, canvasSize.width, canvasSize.height);
      const lastClient = normalizedToClient(last, canvasSize.width, canvasSize.height);
      const distance = Math.hypot(lastClient.x - firstClient.x, lastClient.y - firstClient.y);
      if ((draft.kind === "lasso" && draft.points.length >= 3) || distance >= 6) {
        setRegions((items) => [...items, draft]);
        setSelectedRegionId(draft.id);
      }
    }
    setDraft(undefined);
  };

  if (!capture) {
    return (
      <main className="capture-loading">
        {error ? (
          <div className="capture-error">
            <Focus size={25} />
            <strong>Screen capture unavailable</strong>
            <p>{error}</p>
            <button type="button" onClick={cancel}>
              Close
            </button>
          </div>
        ) : (
          <Spinner label="Preparing private capture…" />
        )}
      </main>
    );
  }

  const activeToolLabel = TOOLS.find((item) => item.id === tool)?.label ?? "Area";

  return (
    <main className="capture-overlay">
      <img src={capture.imageDataUrl} alt="Current screen snapshot" draggable={false} />
      <svg
        ref={canvasRef}
        className="capture-canvas"
        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          setDraft(undefined);
          setInteraction(undefined);
        }}
        aria-label="Screen region selection surface"
      >
        <defs>
          <mask id="capture-dim-mask">
            <rect width="100%" height="100%" fill="white" />
            {regions.map((region) => (
              <RegionMask key={region.id} region={region} size={canvasSize} />
            ))}
            {draft && <RegionMask region={draft} size={canvasSize} />}
          </mask>
        </defs>
        <rect
          className={`capture-dim-layer ${regions.length || draft ? "has-selection" : ""}`}
          width="100%"
          height="100%"
          mask="url(#capture-dim-mask)"
        />
        {regions.map((region) => (
          <RegionShape
            key={region.id}
            region={region}
            size={canvasSize}
            selected={region.id === selectedRegionId}
          />
        ))}
        {draft && <RegionShape region={draft} size={canvasSize} active />}
      </svg>

      <button className="capture-close" type="button" onClick={cancel}>
        <X size={17} /> Cancel capture
      </button>

      <div className="capture-guide">
        <Focus size={15} />
        <span>
          <strong>
            {!armed
              ? "Preparing selection"
              : regions.length
                ? `${regions.length} selected · drag to move`
                : `Drag to select with ${activeToolLabel}`}
          </strong>
          {selectedRegionId
            ? "Use the handles to resize · Delete removes it"
            : "Enter continues · Esc always cancels"}
        </span>
      </div>

      <section className="capture-toolbar" aria-label="Selection tools">
        <div className="capture-tool-group">
          {TOOLS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={tool === item.id ? "active" : ""}
              aria-label={`${item.label} (${item.shortcut})`}
              aria-pressed={tool === item.id}
              data-tooltip={`${item.label} · ${item.shortcut}`}
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
        <div className="capture-edit-group">
          <button
            type="button"
            onClick={() => {
              setRegions((items) => items.slice(0, -1));
              setSelectedRegionId(undefined);
            }}
            disabled={regions.length === 0}
            aria-label="Undo last selection"
            data-tooltip="Undo · Ctrl+Z"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            onClick={() => {
              setRegions([]);
              setSelectedRegionId(undefined);
            }}
            disabled={regions.length === 0}
            aria-label="Clear selections"
            data-tooltip="Clear all"
          >
            <Trash2 size={17} />
          </button>
        </div>
        <button className="capture-cancel" type="button" onClick={cancel}>
          Cancel
        </button>
        <button
          className="capture-commit"
          type="button"
          onClick={commit}
          disabled={regions.length === 0 || saving}
        >
          {saving ? (
            <Spinner label="Preparing…" />
          ) : (
            <>
              <Check size={17} /> Continue
            </>
          )}
        </button>
      </section>
      {error && <div className="capture-toast">{error}</div>}
    </main>
  );
}
