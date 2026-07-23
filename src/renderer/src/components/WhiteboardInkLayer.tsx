import {
  Check,
  Eraser,
  Highlighter,
  Pencil,
  Redo2,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  WhiteboardInkContext,
  WhiteboardInkPoint,
  WhiteboardInkStroke,
  WhiteboardInkTool,
} from "../../../shared/types";

type InkTool = WhiteboardInkTool | "eraser";

const INK_COLORS = ["#52b8e8", "#f4c95d", "#f4f1e8"] as const;
const PEN_WIDTH = 3.4;
const HIGHLIGHTER_WIDTH = 18;

export function WhiteboardInkLayer({
  sessionId,
  canvasStyle,
  canvasWidth,
  canvasHeight,
  sourceRect,
  initialStrokes,
  initialCoordinateSpace,
  busy,
  onAsk,
  onActivity,
  onInkChange,
  onExit,
  reviewPending,
  onAcceptResponse,
  onRejectResponse,
}: {
  sessionId: string;
  canvasStyle: CSSProperties;
  canvasWidth: number;
  canvasHeight: number;
  sourceRect: { left: number; top: number; width: number; height: number };
  initialStrokes: WhiteboardInkStroke[];
  initialCoordinateSpace: "screen" | "selection";
  busy: boolean;
  onAsk: (ink: WhiteboardInkContext) => Promise<void>;
  onActivity: () => void;
  onInkChange: (ink: WhiteboardInkContext | undefined) => void;
  onExit: () => void;
  reviewPending: boolean;
  onAcceptResponse: () => void;
  onRejectResponse: () => Promise<void>;
}) {
  const [tool, setTool] = useState<InkTool>("pen");
  const [color, setColor] = useState<(typeof INK_COLORS)[number]>(INK_COLORS[0]);
  const [strokes, setStrokes] = useState<WhiteboardInkStroke[]>(() =>
    initialCoordinateSpace === "screen"
      ? initialStrokes
      : selectionInkToScreen(initialStrokes, sourceRect, canvasWidth, canvasHeight),
  );
  const [redo, setRedo] = useState<WhiteboardInkStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const draftPathRef = useRef<SVGPathElement>(null);
  const draftPoints = useRef<WhiteboardInkPoint[]>([]);
  const activePointer = useRef<number | null>(null);
  const initializedSession = useRef("");

  useEffect(() => {
    if (!sessionId || initializedSession.current === sessionId) return;
    initializedSession.current = sessionId;
    setStrokes(
      initialCoordinateSpace === "screen"
        ? initialStrokes
        : selectionInkToScreen(initialStrokes, sourceRect, canvasWidth, canvasHeight),
    );
    setRedo([]);
    setDrawing(false);
    draftPoints.current = [];
  }, [
    canvasHeight,
    canvasWidth,
    initialCoordinateSpace,
    initialStrokes,
    sessionId,
    sourceRect,
  ]);

  const inkContext = useCallback(
    (currentStrokes: WhiteboardInkStroke[]): WhiteboardInkContext => ({
      strokes: currentStrokes,
      imageDataUrl: renderInkPng(currentStrokes, canvasWidth, canvasHeight),
      coordinateSpace: "screen",
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
        sourceRect,
      },
    }),
    [canvasHeight, canvasWidth, sourceRect],
  );

  useEffect(() => {
    onInkChange(strokes.length ? inkContext(strokes) : undefined);
  }, [inkContext, onInkChange, strokes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onExit();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          setRedo((currentRedo) => {
            const next = currentRedo.at(-1);
            if (!next) return currentRedo;
            setStrokes((current) => [...current, next]);
            return currentRedo.slice(0, -1);
          });
        } else {
          setStrokes((current) => {
            const removed = current.at(-1);
            if (!removed) return current;
            setRedo((currentRedo) => [...currentRedo, removed]);
            return current.slice(0, -1);
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (busy || event.button !== 0 || activePointer.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    onActivity();
    if (tool === "eraser") {
      eraseAt(toInkPoint(event.nativeEvent, event.currentTarget), strokes, setStrokes, setRedo);
      return;
    }
    const points = coalescedInkPoints(event.nativeEvent, event.currentTarget);
    draftPoints.current = points;
    setDrawing(true);
    updateDraftPath(draftPathRef.current, points);
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (busy || event.pointerId !== activePointer.current) return;
    event.preventDefault();
    if (tool === "eraser") {
      eraseAt(toInkPoint(event.nativeEvent, event.currentTarget), strokes, setStrokes, setRedo);
      return;
    }
    const points = draftPoints.current;
    const additions = coalescedInkPoints(event.nativeEvent, event.currentTarget);
    for (const point of additions) {
      const prior = points.at(-1);
      if (!prior || Math.hypot(point.x - prior.x, point.y - prior.y) >= 0.65) points.push(point);
    }
    updateDraftPath(draftPathRef.current, points);
  };

  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (event.pointerId !== activePointer.current) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (tool === "eraser") return;
    const points = draftPoints.current;
    draftPoints.current = [];
    setDrawing(false);
    updateDraftPath(draftPathRef.current, []);
    if (points.length === 0) return;
    const stroke: WhiteboardInkStroke = {
      id: crypto.randomUUID(),
      tool,
      color,
      width: tool === "highlighter" ? HIGHLIGHTER_WIDTH : PEN_WIDTH,
      points: limitPoints(points, 360),
    };
    setStrokes((current) => [...current.slice(-47), stroke]);
    setRedo([]);
  };

  const undo = (): void => {
    setStrokes((current) => {
      const removed = current.at(-1);
      if (!removed) return current;
      setRedo((currentRedo) => [...currentRedo.slice(-47), removed]);
      return current.slice(0, -1);
    });
  };

  const redoStroke = (): void => {
    setRedo((current) => {
      const restored = current.at(-1);
      if (!restored) return current;
      setStrokes((currentStrokes) => [...currentStrokes, restored]);
      return current.slice(0, -1);
    });
  };

  const ask = async (): Promise<void> => {
    if (busy || strokes.length === 0) return;
    onActivity();
    await onAsk(inkContext(strokes));
  };

  const activeWidth = tool === "highlighter" ? HIGHLIGHTER_WIDTH : PEN_WIDTH;
  return (
    <>
      <svg
        className={`whiteboard-user-ink tool-${tool}${busy ? " busy" : ""}`}
        style={canvasStyle}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        ref={svgRef}
        aria-label="Draw anywhere on the lesson screen"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        {strokes.map((stroke) => (
          <path
            className={stroke.tool === "highlighter" ? "user-highlight" : "user-pen"}
            d={strokePath(stroke.points)}
            key={stroke.id}
            fill="none"
            stroke={stroke.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={stroke.width}
          />
        ))}
        <path
          className={tool === "highlighter" ? "user-highlight" : "user-pen"}
          fill="none"
          ref={draftPathRef}
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={activeWidth}
          visibility={drawing ? "visible" : "hidden"}
        />
      </svg>
      <nav className="whiteboard-ink-tools" aria-label="Whiteboard drawing tools">
        <div className="ink-tool-group">
          <ToolButton
            active={tool === "pen"}
            label="Pen"
            onClick={() => setTool("pen")}
            icon={<Pencil size={15} />}
          />
          <ToolButton
            active={tool === "highlighter"}
            label="Mark"
            onClick={() => setTool("highlighter")}
            icon={<Highlighter size={15} />}
          />
          <ToolButton
            active={tool === "eraser"}
            label="Erase"
            onClick={() => setTool("eraser")}
            icon={<Eraser size={15} />}
          />
        </div>
        <fieldset className="ink-colors" aria-label="Ink color">
          {INK_COLORS.map((candidate) => (
            <button
              aria-label={`Use ${candidate} ink`}
              className={candidate === color ? "selected" : ""}
              key={candidate}
              onClick={() => setColor(candidate)}
              style={{ "--ink-choice": candidate } as CSSProperties}
              type="button"
            />
          ))}
        </fieldset>
        <div className="ink-tool-group ink-history">
          <button
            aria-label="Undo stroke"
            disabled={!strokes.length || busy}
            onClick={undo}
            type="button"
          >
            <Undo2 size={15} />
          </button>
          <button
            aria-label="Redo stroke"
            disabled={!redo.length || busy}
            onClick={redoStroke}
            type="button"
          >
            <Redo2 size={15} />
          </button>
          <button
            aria-label="Clear learner ink"
            disabled={!strokes.length || busy}
            onClick={() => {
              setStrokes([]);
              setRedo([]);
            }}
            type="button"
          >
            <Trash2 size={15} />
          </button>
        </div>
        {reviewPending ? (
          <fieldset className="ink-review-actions" aria-label="Review AI response">
            <button className="ink-keep" onClick={onAcceptResponse} type="button">
              Keep response
              <Check size={14} />
            </button>
            <button className="ink-reject" onClick={() => void onRejectResponse()} type="button">
              Undo AI
              <RotateCcw size={14} />
            </button>
          </fieldset>
        ) : (
          <button
            className="ink-ask"
            disabled={!strokes.length || busy}
            onClick={() => void ask()}
            type="button"
          >
            {busy ? "Reading your ink…" : "Ask about ink"}
            <Send size={14} />
          </button>
        )}
        <button className="ink-exit" aria-label="Exit drawing mode" onClick={onExit} type="button">
          <X size={15} />
        </button>
      </nav>
    </>
  );
}

function ToolButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function coalescedInkPoints(
  event: globalThis.PointerEvent,
  svg: SVGSVGElement,
): WhiteboardInkPoint[] {
  const coalesced = event.getCoalescedEvents?.() ?? [];
  return (coalesced.length ? coalesced : [event]).map((point) => toInkPoint(point, svg));
}

function toInkPoint(event: globalThis.PointerEvent, svg: SVGSVGElement): WhiteboardInkPoint {
  const rect = svg.getBoundingClientRect();
  return {
    x: clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 1000, 0, 1000),
    y: clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 1000, 0, 1000),
    pressure: clamp(event.pressure || (event.buttons ? 0.5 : 0), 0, 1),
  };
}

function strokePath(points: WhiteboardInkPoint[]): string {
  const first = points.at(0);
  if (!first) return "";
  if (points.length === 1) {
    return `M ${first.x} ${first.y} l 0.01 0`;
  }
  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points.at(index);
    const next = points.at(index + 1);
    if (!point || !next) continue;
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = points.at(-1);
  return `${path} L ${last?.x ?? 0} ${last?.y ?? 0}`;
}

function updateDraftPath(path: SVGPathElement | null, points: WhiteboardInkPoint[]): void {
  path?.setAttribute("d", strokePath(points));
}

function eraseAt(
  point: WhiteboardInkPoint,
  strokes: WhiteboardInkStroke[],
  setStrokes: React.Dispatch<React.SetStateAction<WhiteboardInkStroke[]>>,
  setRedo: React.Dispatch<React.SetStateAction<WhiteboardInkStroke[]>>,
): void {
  const hit = [...strokes]
    .reverse()
    .find((stroke) =>
      stroke.points.some(
        (sample) => Math.hypot(sample.x - point.x, sample.y - point.y) <= stroke.width + 12,
      ),
    );
  if (!hit) return;
  setStrokes((current) => current.filter((stroke) => stroke.id !== hit.id));
  setRedo([]);
}

function renderInkPng(
  strokes: WhiteboardInkStroke[],
  canvasWidth: number,
  canvasHeight: number,
): string {
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.round(canvasWidth * scale));
  const height = Math.max(1, Math.round(canvasHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The whiteboard could not prepare the ink image.");
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.save();
    context.strokeStyle = stroke.color;
    context.globalAlpha = stroke.tool === "highlighter" ? 0.3 : 0.96;
    context.lineWidth = (stroke.width * Math.min(width, height)) / 1000;
    context.beginPath();
    stroke.points.forEach((point, index) => {
      const x = (point.x / 1000) * width;
      const y = (point.y / 1000) * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  }
  return canvas.toDataURL("image/png");
}

export function selectionInkToScreen(
  strokes: WhiteboardInkStroke[],
  sourceRect: { left: number; top: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
): WhiteboardInkStroke[] {
  if (!strokes.length || canvasWidth <= 0 || canvasHeight <= 0) return strokes;
  const widthScale =
    Math.min(sourceRect.width, sourceRect.height) / Math.max(1, Math.min(canvasWidth, canvasHeight));
  return strokes.map((stroke) => ({
    ...stroke,
    width: Math.max(1, stroke.width * widthScale),
    points: stroke.points.map((point) => ({
      ...point,
      x: ((sourceRect.left + (point.x / 1000) * sourceRect.width) / canvasWidth) * 1000,
      y: ((sourceRect.top + (point.y / 1000) * sourceRect.height) / canvasHeight) * 1000,
    })),
  }));
}

function limitPoints(points: WhiteboardInkPoint[], limit: number): WhiteboardInkPoint[] {
  if (points.length <= limit) return points;
  const limited: WhiteboardInkPoint[] = [];
  for (let index = 0; index < limit; index += 1) {
    const point = points.at(Math.round((index * (points.length - 1)) / (limit - 1)));
    if (point) limited.push(point);
  }
  return limited;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
