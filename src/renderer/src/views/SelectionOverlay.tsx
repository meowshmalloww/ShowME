import {
  ArrowRight,
  CornerDownLeft,
  LassoSelect,
  Maximize,
  MousePointer2,
  Redo2,
  Scan,
  Undo2,
  X,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { clientToNormalized, snapNormalizedPoint } from "../../../shared/coordinates";
import { finalizeLasso } from "../../../shared/selection";
import type { CapturePayload, Point, SelectionKind, SelectionRegion } from "../../../shared/types";
import { errorMessage, Spinner } from "../components/Ui";

type Tool = "rectangle" | "lasso" | "arrow" | "point";

const tools: { id: Tool; label: string; icon: typeof Scan }[] = [
  { id: "rectangle", label: "Area", icon: Scan },
  { id: "lasso", label: "Lasso", icon: LassoSelect },
  { id: "arrow", label: "Point out", icon: ArrowRight },
  { id: "point", label: "Point", icon: MousePointer2 },
];

export function SelectionOverlay() {
  const [capture, setCapture] = useState<CapturePayload | null>(null);
  const [tool, setTool] = useState<Tool>("rectangle");
  const [regions, setRegions] = useState<SelectionRegion[]>([]);
  const [redo, setRedo] = useState<SelectionRegion[]>([]);
  const [draft, setDraft] = useState<SelectionRegion | null>(null);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });
  const surface = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<SelectionRegion | null>(null);

  useEffect(() => {
    void window.showme.capture
      .pending()
      .then(setCapture)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const update = (): void => {
      const rect = element.getBoundingClientRect();
      setSurfaceSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") void window.showme.capture.cancel();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          const item = redo.at(-1);
          if (item) {
            setRedo(redo.slice(0, -1));
            setRegions([...regions, item]);
          }
        } else {
          const item = regions.at(-1);
          if (item) {
            setRegions(regions.slice(0, -1));
            setRedo([...redo, item]);
          }
        }
      }
      if (event.key === "Enter" && regions.length > 0 && capture && !committing) {
        setCommitting(true);
        setError("");
        void window.showme.capture
          .commit({ captureId: capture.captureId, regions })
          .catch((reason) => {
            setError(errorMessage(reason));
            setCommitting(false);
          });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, committing, redo, regions]);

  const allRegions = useMemo(() => (draft ? [...regions, draft] : regions), [regions, draft]);

  const pointFromEvent = (event: ReactPointerEvent): Point => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return clientToNormalized(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      rect.width,
      rect.height,
    );
  };

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || committing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointFromEvent(event);
    const region: SelectionRegion = {
      id: crypto.randomUUID(),
      kind: tool as SelectionKind,
      points: tool === "point" ? [start] : tool === "lasso" ? [start] : [start, start],
    };
    if (tool === "point") {
      setRegions([...regions, region]);
      setRedo([]);
    } else {
      draftRef.current = region;
      setDraft(region);
    }
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draftRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    let next = pointFromEvent(event);
    if (draftRef.current.kind === "arrow" && event.shiftKey) {
      const rect = surface.current?.getBoundingClientRect();
      if (rect)
        next = snapNormalizedPoint(
          draftRef.current.points[0] ?? next,
          next,
          rect.width,
          rect.height,
        );
    }
    setDraft((current) => {
      if (!current) return null;
      if (current.kind === "lasso") {
        const previous = current.points.at(-1) ?? next;
        if (Math.hypot(previous.x - next.x, previous.y - next.y) < 4) return current;
        if (current.points.length >= 240) return current;
        const updated = { ...current, points: [...current.points, next] };
        draftRef.current = updated;
        return updated;
      }
      const updated = { ...current, points: [current.points[0] ?? next, next] };
      draftRef.current = updated;
      return updated;
    });
  };

  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const end = pointFromEvent(event);
    const finalized =
      currentDraft.kind === "lasso"
        ? finalizeLasso(currentDraft, end)
        : { ...currentDraft, points: [currentDraft.points[0] ?? end, end] };
    const bounds = regionDimensions(finalized);
    const valid =
      finalized.kind === "lasso"
        ? finalized.points.length >= 3 && bounds.width > 5 && bounds.height > 5
        : bounds.width > 5 || bounds.height > 5;
    if (valid) {
      setRegions([...regions, finalized]);
      setRedo([]);
    }
    draftRef.current = null;
    setDraft(null);
  };

  const undo = (): void => {
    const item = regions.at(-1);
    if (!item) return;
    setRegions(regions.slice(0, -1));
    setRedo([...redo, item]);
  };

  const redoLast = (): void => {
    const item = redo.at(-1);
    if (!item) return;
    setRedo(redo.slice(0, -1));
    setRegions([...regions, item]);
  };

  const commit = async (selected: SelectionRegion[]): Promise<void> => {
    if (!capture || committing) return;
    setCommitting(true);
    setError("");
    try {
      await window.showme.capture.commit({ captureId: capture.captureId, regions: selected });
    } catch (reason) {
      setError(errorMessage(reason));
      setCommitting(false);
    }
  };

  const cancel = async (): Promise<void> => {
    await window.showme.capture.cancel();
  };

  return (
    <main className="selection-shell">
      {capture ? (
        <img
          className="capture-image"
          src={capture.imageDataUrl}
          alt="Current display"
          draggable={false}
        />
      ) : null}
      <div
        className={"selection-surface tool-" + tool}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        ref={surface}
      >
        <SelectionSvg regions={allRegions} width={surfaceSize.width} height={surfaceSize.height} />
      </div>
      <div className="selection-hint">
        <strong>
          {regions.length
            ? regions.length + " focus " + (regions.length === 1 ? "area" : "areas")
            : "Drag over what matters"}
        </strong>
        <small>Everything else stays out of the lesson</small>
      </div>
      <div className="selection-toolbar glass-panel">
        <div className="tool-group">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={tool === item.id ? "active" : ""}
                aria-label={item.label}
                data-tooltip={item.label}
                key={item.id}
                onClick={() => setTool(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <span className="toolbar-divider" />
        <button
          aria-label="Undo"
          data-tooltip="Undo"
          disabled={regions.length === 0}
          onClick={undo}
          type="button"
        >
          <Undo2 size={17} />
        </button>
        <button
          aria-label="Redo"
          data-tooltip="Redo"
          disabled={redo.length === 0}
          onClick={redoLast}
          type="button"
        >
          <Redo2 size={17} />
        </button>
        <span className="toolbar-divider" />
        <button className="screen-button" onClick={() => commit([])} type="button">
          <Maximize size={16} /> Entire screen
        </button>
        <button
          className="done-selection"
          disabled={regions.length === 0 || committing}
          onClick={() => commit(regions)}
          type="button"
        >
          {committing ? <Spinner small /> : <CornerDownLeft size={16} />} Explain selection
        </button>
        <button className="cancel-selection" aria-label="Cancel" onClick={cancel} type="button">
          <X size={18} />
        </button>
      </div>
      {error ? <div className="selection-error">{error}</div> : null}
      {!capture && !error ? (
        <div className="capture-loading">
          <Spinner />
          <span>Freezing the screen for selection</span>
        </div>
      ) : null}
    </main>
  );
}

function SelectionSvg({
  regions,
  width,
  height,
}: {
  regions: SelectionRegion[];
  width: number;
  height: number;
}) {
  const pixelRegions = regions.map((region) => ({
    ...region,
    points: region.points.map((point) => ({
      x: (point.x / 1000) * width,
      y: (point.y / 1000) * height,
    })),
  }));
  return (
    <svg className="selection-svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <mask id="selection-cutouts">
          <rect width={width} height={height} fill="white" />
          {pixelRegions.map((region) => (
            <RegionShape key={"mask-" + region.id} region={region} mask />
          ))}
        </mask>
        <filter id="selection-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
        </filter>
      </defs>
      <rect
        width={width}
        height={height}
        fill="rgba(5, 7, 10, .54)"
        mask="url(#selection-cutouts)"
      />
      {pixelRegions.map((region, index) => (
        <g key={region.id}>
          <RegionShape region={region} />
          <circle
            cx={(region.points[0]?.x ?? 0) + 12}
            cy={(region.points[0]?.y ?? 0) + 12}
            r="9"
            className="selection-index"
          />
          <text
            x={(region.points[0]?.x ?? 0) + 12}
            y={(region.points[0]?.y ?? 0) + 15}
            textAnchor="middle"
            className="selection-index-text"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RegionShape({ region, mask = false }: { region: SelectionRegion; mask?: boolean }) {
  const first = region.points[0] ?? { x: 0, y: 0 };
  const last = region.points.at(-1) ?? first;
  const bounds = regionDimensions(region);
  const common = mask
    ? { fill: "black", stroke: "black", strokeWidth: 10 }
    : { className: "selection-outline" };
  if (region.kind === "rectangle")
    return (
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        rx="10"
        {...common}
      />
    );
  if (region.kind === "circle")
    return (
      <ellipse
        cx={bounds.x + bounds.width / 2}
        cy={bounds.y + bounds.height / 2}
        rx={bounds.width / 2}
        ry={bounds.height / 2}
        {...common}
      />
    );
  if (region.kind === "lasso")
    return (
      <polygon
        points={region.points.map((point) => point.x + "," + point.y).join(" ")}
        {...common}
      />
    );
  if (region.kind === "point")
    return <circle cx={first.x} cy={first.y} r={mask ? 20 : 11} {...common} />;
  if (region.kind === "arrow") {
    return (
      <g className={mask ? "mask-line" : "selection-arrow"}>
        <line x1={first.x} y1={first.y} x2={last.x} y2={last.y} {...common} />
        {!mask ? <polyline points={arrowHead(first, last)} /> : null}
      </g>
    );
  }
  return null;
}

function regionDimensions(region: SelectionRegion) {
  const xs = region.points.map((point) => point.x);
  const ys = region.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function arrowHead(start: Point, end: Point): string {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = 15;
  const a = {
    x: end.x - Math.cos(angle - Math.PI / 6) * length,
    y: end.y - Math.sin(angle - Math.PI / 6) * length,
  };
  const b = {
    x: end.x - Math.cos(angle + Math.PI / 6) * length,
    y: end.y - Math.sin(angle + Math.PI / 6) * length,
  };
  return a.x + "," + a.y + " " + end.x + "," + end.y + " " + b.x + "," + b.y;
}
