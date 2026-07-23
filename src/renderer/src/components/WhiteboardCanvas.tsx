import { type CSSProperties, type PointerEvent, useEffect, useMemo, useState } from "react";
import rough from "roughjs";
import type {
  ImageAsset,
  LessonContextGeometry,
  LessonPlan,
  LessonPrimitive,
  ScreenContrastMap,
  WhiteboardInkContext,
} from "../../../shared/types";
import { SimulationGraphic } from "./LessonCanvas";
import { WhiteboardInkLayer } from "./WhiteboardInkLayer";

interface Viewport {
  width: number;
  height: number;
}

interface SourceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LayoutRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const WHITEBOARD_PALETTE = [
  {
    id: "cyan",
    color: "#65dcff",
    wash: "rgba(101, 220, 255, 0.16)",
    highlightWash: "rgba(101, 220, 255, 0.045)",
  },
  {
    id: "amber",
    color: "#ffc857",
    wash: "rgba(255, 200, 87, 0.17)",
    highlightWash: "rgba(255, 200, 87, 0.05)",
  },
  {
    id: "violet",
    color: "#b79cff",
    wash: "rgba(183, 156, 255, 0.17)",
    highlightWash: "rgba(183, 156, 255, 0.05)",
  },
  {
    id: "mint",
    color: "#67e8b5",
    wash: "rgba(103, 232, 181, 0.16)",
    highlightWash: "rgba(103, 232, 181, 0.045)",
  },
  {
    id: "coral",
    color: "#ff8b7b",
    wash: "rgba(255, 139, 123, 0.17)",
    highlightWash: "rgba(255, 139, 123, 0.05)",
  },
] as const;

type WhiteboardPaletteEntry = (typeof WHITEBOARD_PALETTE)[number];
const whiteboardInk = rough.generator();
type RoughInkOptions = NonNullable<Parameters<typeof whiteboardInk.line>[4]>;
type RoughDrawable = ReturnType<typeof whiteboardInk.line>;

export interface WhiteboardTextLayout extends LayoutRect {
  width: number;
  height: number;
  centerY: number;
}

export interface WhiteboardLearningCheck {
  phase: "awaiting" | "retry" | "correct";
  stage: "diagnostic" | "try" | "transfer";
  prompt: string;
  choices?: string[];
  pointMode?: boolean;
  message?: string;
  attemptCount: number;
}

export function WhiteboardCanvas({
  plan,
  stepIndex,
  reducedMotion,
  contextGeometry,
  imageAsset,
  learningCheck,
  phase = "active",
  historyMode = "context",
  pinnedPrimitiveIds = [],
  onPointAnswer,
  inkSessionId,
  inkBusy = false,
  onInkAsk,
  onInkActivity,
  onInkChange,
  onExit,
  inkReviewPending = false,
  onAcceptInkResponse,
  onRejectInkResponse,
  initialInkStrokes = [],
  initialInkSpace = "selection",
}: {
  plan: LessonPlan;
  stepIndex: number;
  reducedMotion: boolean;
  contextGeometry?: LessonContextGeometry;
  imageAsset?: ImageAsset;
  learningCheck?: WhiteboardLearningCheck;
  phase?: "active" | "fading";
  historyMode?: "current" | "context";
  pinnedPrimitiveIds?: string[];
  onPointAnswer?: (point: { x: number; y: number }) => void;
  inkSessionId?: string;
  inkBusy?: boolean;
  onInkAsk?: (ink: WhiteboardInkContext) => Promise<void>;
  onInkActivity?: () => void;
  onInkChange?: (ink: WhiteboardInkContext | undefined) => void;
  onExit?: () => void;
  inkReviewPending?: boolean;
  onAcceptInkResponse?: () => void;
  onRejectInkResponse?: () => Promise<void>;
  initialInkStrokes?: WhiteboardInkContext["strokes"];
  initialInkSpace?: "screen" | "selection";
}) {
  const viewport = useViewport();
  const source = useMemo(
    () => projectSourceRect(contextGeometry, viewport),
    [contextGeometry, viewport],
  );
  const currentIds = useMemo(
    () => new Set(plan.steps[stepIndex]?.primitiveIds ?? []),
    [plan.steps, stepIndex],
  );
  const previousIds = useMemo(
    () => new Set(stepIndex > 0 ? (plan.steps[stepIndex - 1]?.primitiveIds ?? []) : []),
    [plan.steps, stepIndex],
  );
  const visibleIds = useMemo(() => {
    const ids = new Set(currentIds);
    if (historyMode === "context") {
      for (const id of previousIds) ids.add(id);
    }
    for (const id of pinnedPrimitiveIds) ids.add(id);
    return ids;
  }, [currentIds, historyMode, pinnedPrimitiveIds, previousIds]);
  const primitives = plan.primitives.filter(
    (primitive) => visibleIds.size === 0 || visibleIds.has(primitive.id),
  );
  const simulationHost = useMemo(
    () => (plan.simulation ? findGroundedSimulationHost(plan.primitives) : undefined),
    [plan.primitives, plan.simulation],
  );
  const geometryPrimitives = primitives.filter(
    (primitive) => !isTextPrimitive(primitive) && primitive.id !== simulationHost?.id,
  );
  const textPrimitives = primitives.filter(isTextPrimitive);
  const sourceStyle: CSSProperties = {
    left: source.left,
    top: source.top,
    width: source.width,
    height: source.height,
  };
  const inkCanvasStyle: CSSProperties = {
    left: 0,
    top: 0,
    width: viewport.width,
    height: viewport.height,
  };
  const aidOnLeft = useMemo(
    () => placeWhiteboardAidOnLeft(plan.primitives, source, viewport),
    [plan.primitives, source, viewport],
  );
  const aidObstacles = useMemo(
    () =>
      simulationHost
        ? []
        : whiteboardAidObstacles(viewport, aidOnLeft, plan.simulation?.kind, Boolean(imageAsset)),
    [aidOnLeft, imageAsset, plan.simulation, simulationHost, viewport],
  );
  const simulationStyle = useMemo(
    () => (simulationHost ? groundedSimulationStyle(simulationHost, source) : undefined),
    [simulationHost, source],
  );
  const textLayouts = useMemo(
    () =>
      layoutWhiteboardText(
        textPrimitives,
        source,
        viewport,
        aidObstacles,
        contextGeometry?.contrastMap,
      ),
    [aidObstacles, contextGeometry?.contrastMap, source, textPrimitives, viewport],
  );
  const cursorTarget = teachingCursorTarget(plan.primitives, currentIds);
  const previousCursorTarget =
    stepIndex > 0 ? teachingCursorTarget(plan.primitives, previousIds) : undefined;
  const pointMode = Boolean(
    learningCheck?.pointMode && learningCheck.phase !== "correct" && onPointAnswer,
  );

  const handlePoint = (event: PointerEvent<HTMLElement>): void => {
    if (!pointMode || !onPointAnswer) return;
    const x = ((event.clientX - source.left) / Math.max(1, source.width)) * 1000;
    const y = ((event.clientY - source.top) / Math.max(1, source.height)) * 1000;
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return;
    onPointAnswer({ x, y });
  };

  return (
    <main
      className={`whiteboard-overlay board-${phase}${reducedMotion ? " reduced-motion" : ""}${pointMode ? " point-mode" : ""}`}
      aria-label={plan.title}
      onPointerDown={handlePoint}
    >
      <svg
        className="whiteboard-geometry"
        style={sourceStyle}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        role="img"
        aria-label={`On-screen explanation: ${plan.title}`}
        data-source-left={Math.round(source.left)}
        data-source-top={Math.round(source.top)}
        data-source-width={Math.round(source.width)}
        data-source-height={Math.round(source.height)}
      >
        <defs>
          <marker
            id="lesson-arrow"
            viewBox="0 0 12 12"
            refX="10.5"
            refY="6"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#65dcff" />
          </marker>
          <marker
            id="sim-arrow"
            viewBox="0 0 12 12"
            refX="10.5"
            refY="6"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#65dcff" />
          </marker>
          <filter id="whiteboard-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {geometryPrimitives.map((primitive, index) => (
          <WhiteboardPrimitive
            key={primitive.id}
            primitive={primitive}
            source={source}
            current={currentIds.has(primitive.id)}
            previous={previousIds.has(primitive.id)}
            order={index}
          />
        ))}
      </svg>

      {cursorTarget ? (
        <TeachingCursor
          key={`${stepIndex}-${cursorTarget.x}-${cursorTarget.y}`}
          target={cursorTarget}
          source={source}
          reducedMotion={reducedMotion}
          {...(previousCursorTarget ? { from: previousCursorTarget } : {})}
        />
      ) : null}

      {textPrimitives.map((primitive, index) => (
        <WhiteboardText
          key={primitive.id}
          primitive={primitive}
          layout={textLayouts[primitive.id]}
          source={source}
          {...(contextGeometry?.contrastMap ? { contrastMap: contextGeometry.contrastMap } : {})}
          current={currentIds.has(primitive.id)}
          previous={previousIds.has(primitive.id)}
          order={index}
        />
      ))}

      {inkSessionId &&
      onInkAsk &&
      onInkActivity &&
      onInkChange &&
      onExit &&
      onAcceptInkResponse &&
      onRejectInkResponse ? (
        <WhiteboardInkLayer
          busy={inkBusy}
          canvasHeight={viewport.height}
          canvasStyle={inkCanvasStyle}
          canvasWidth={viewport.width}
          initialCoordinateSpace={initialInkSpace}
          initialStrokes={initialInkStrokes}
          onAcceptResponse={onAcceptInkResponse}
          onActivity={onInkActivity}
          onAsk={onInkAsk}
          onInkChange={onInkChange}
          onExit={onExit}
          onRejectResponse={onRejectInkResponse}
          reviewPending={inkReviewPending}
          sessionId={inkSessionId}
          sourceRect={source}
        />
      ) : null}

      {plan.simulation ? (
        <section
          className={`whiteboard-simulation sim-${plan.simulation.kind} ${
            simulationHost ? "grounded" : aidOnLeft ? "aid-left" : "aid-right"
          }`}
          style={simulationStyle}
          aria-label="Animated explanation"
        >
          <SimulationGraphic simulation={plan.simulation} reducedMotion={reducedMotion} />
        </section>
      ) : imageAsset ? (
        <figure className={"whiteboard-media " + (aidOnLeft ? "aid-left" : "aid-right")}>
          <img src={imageAsset.thumbnailUrl} alt={imageAsset.description || imageAsset.title} />
          <figcaption>
            {imageAsset.title} · {imageAsset.artist} · {imageAsset.license}
          </figcaption>
        </figure>
      ) : null}

      {learningCheck ? (
        <aside
          className={`whiteboard-learning-check check-${learningCheck.phase} ${
            aidOnLeft ? "check-right" : "check-left"
          }`}
          aria-live="polite"
        >
          <span className="learning-check-kicker">
            {learningCheck.phase === "correct"
              ? learningCheck.stage === "transfer"
                ? "Transfer observed"
                : learningCheck.stage === "diagnostic"
                  ? "Focus selected"
                  : "Try completed"
              : learningCheck.phase === "retry"
                ? "Try once more"
                : learningCheck.stage === "diagnostic"
                  ? "Choose a focus"
                  : learningCheck.stage === "transfer"
                    ? "Transfer"
                    : "Try it"}
          </span>
          <strong>{learningCheck.prompt}</strong>
          {learningCheck.choices?.length ? (
            <span className="learning-check-choices">
              {learningCheck.choices
                .map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`)
                .join("  ·  ")}
            </span>
          ) : null}
          <small>{learningCheck.message ?? "Say “Show me, my answer is …”"}</small>
        </aside>
      ) : null}
    </main>
  );
}

function WhiteboardPrimitive({
  primitive,
  source,
  current,
  previous,
  order,
}: {
  primitive: LessonPrimitive;
  source: SourceRect;
  current: boolean;
  previous: boolean;
  order: number;
}) {
  const palette = whiteboardPalette(primitive, order);
  const primitiveWidth = primitive.width ?? 140;
  const primitiveHeight = primitive.height ?? 90;
  const isBroadHighlight =
    primitive.kind === "highlight" &&
    (primitiveWidth > 320 || primitiveHeight > 260 || primitiveWidth * primitiveHeight > 72_000);
  const strokeWidth = isBroadHighlight ? 1.05 : clamp(primitive.strokeWidth ?? 2.1, 1.25, 2.85);
  const className = `whiteboard-stroke${isBroadHighlight ? " broad-highlight" : ""}${previous && !current ? " previous" : ""}${current ? " current" : ""}`;
  const style = {
    "--whiteboard-delay": `${Math.min(order * 70, 420)}ms`,
    "--whiteboard-color": palette.color,
  } as CSSProperties;
  const inkOptions: RoughInkOptions = {
    seed: Math.max(1, Math.abs(hashText(primitive.id)) % 2_147_483_647),
    stroke: palette.color,
    strokeWidth,
    roughness: isBroadHighlight ? 0.34 : primitive.kind === "point" ? 0.48 : 0.72,
    bowing: 0.62,
    maxRandomnessOffset: isBroadHighlight ? 0.65 : 1.35,
    preserveVertices: true,
    disableMultiStroke: isBroadHighlight,
    fillStyle: "solid",
    ...(isBroadHighlight
      ? { strokeLineDash: [10, 13] }
      : primitive.dashed
        ? { strokeLineDash: [12, 10] }
        : {}),
  };
  const opacity = isBroadHighlight ? 0.58 : 1;
  const shortestSourceSide = Math.max(1, Math.min(source.width, source.height));
  const circleRadius = primitive.radius ?? (primitive.kind === "point" ? 9 : 72);
  const circleRadiusX = (circleRadius * shortestSourceSide) / Math.max(1, source.width);
  const circleRadiusY = (circleRadius * shortestSourceSide) / Math.max(1, source.height);
  if (primitive.kind === "circle" || primitive.kind === "point") {
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.ellipse(primitive.x, primitive.y, circleRadiusX * 2, circleRadiusY * 2, {
            ...inkOptions,
            fill: primitive.kind === "point" ? palette.color : palette.wash,
          }),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "rect" || primitive.kind === "highlight") {
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.rectangle(primitive.x, primitive.y, primitiveWidth, primitiveHeight, {
            ...inkOptions,
            ...(primitive.kind === "highlight" && !isBroadHighlight
              ? { fill: palette.wash, strokeWidth: Math.min(strokeWidth, 1.65) }
              : {}),
          }),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "underline") {
    const x2 = primitive.x2 ?? primitive.x + 140;
    const y2 = primitive.y2 ?? primitive.y;
    const midX = (primitive.x + x2) / 2;
    const midY = (primitive.y + y2) / 2 + 3.5;
    return (
      <RoughInk
        className={`${className} whiteboard-underline`}
        drawables={[
          whiteboardInk.curve(
            [
              [primitive.x, primitive.y],
              [midX, midY],
              [x2, y2],
            ],
            {
              ...inkOptions,
              roughness: 0.9,
              bowing: 0.8,
              strokeWidth: Math.min(strokeWidth, 2.35),
            },
          ),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "line" || primitive.kind === "arrow" || primitive.kind === "vector") {
    const x2 = primitive.x2 ?? primitive.x + 120;
    const y2 = primitive.y2 ?? primitive.y;
    const drawables = [whiteboardInk.line(primitive.x, primitive.y, x2, y2, inkOptions)];
    if (primitive.kind !== "line") {
      drawables.push(roughArrowHead(primitive.x, primitive.y, x2, y2, inkOptions));
    }
    return <RoughInk className={className} drawables={drawables} opacity={opacity} style={style} />;
  }
  if (primitive.kind === "curved-arrow") {
    const x2 = primitive.x2 ?? primitive.x + 150;
    const y2 = primitive.y2 ?? primitive.y;
    const midX = (primitive.x + x2) / 2;
    const midY = Math.min(primitive.y, y2) - Math.max(55, Math.abs(x2 - primitive.x) * 0.28);
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.curve(
            [
              [primitive.x, primitive.y],
              [midX, midY],
              [x2, y2],
            ],
            inkOptions,
          ),
          roughArrowHead(midX, midY, x2, y2, inkOptions),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "path") {
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.linearPath(
            (primitive.points ?? []).map((point) => [point.x, point.y]),
            inkOptions,
          ),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "axis") {
    const verticalEndY = primitive.y ?? 150;
    const horizontalEndX = primitive.x2 ?? 850;
    const axisBaseY = primitive.y2 ?? 850;
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.line(primitive.x, axisBaseY, primitive.x, verticalEndY, inkOptions),
          roughArrowHead(primitive.x, axisBaseY, primitive.x, verticalEndY, inkOptions),
          whiteboardInk.line(primitive.x, primitive.y, horizontalEndX, primitive.y, inkOptions),
          roughArrowHead(primitive.x, primitive.y, horizontalEndX, primitive.y, inkOptions),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "bracket") {
    return (
      <RoughInk
        className={className}
        drawables={[
          whiteboardInk.linearPath(
            [
              [primitive.x, primitive.y],
              [primitive.x - 18, primitive.y],
              [primitive.x - 18, primitive.y + (primitive.height ?? 140)],
              [primitive.x, primitive.y + (primitive.height ?? 140)],
            ],
            inkOptions,
          ),
        ]}
        opacity={opacity}
        style={style}
      />
    );
  }
  if (primitive.kind === "spotlight") {
    const spotlightRadius = primitive.radius ?? 100;
    const spotlightRadiusX = (spotlightRadius * shortestSourceSide) / Math.max(1, source.width);
    const spotlightRadiusY = (spotlightRadius * shortestSourceSide) / Math.max(1, source.height);
    return (
      <g
        className={`whiteboard-spotlight${previous && !current ? " previous" : ""}${current ? " current" : ""}`}
      >
        <ellipse
          cx={primitive.x}
          cy={primitive.y}
          rx={spotlightRadiusX}
          ry={spotlightRadiusY}
          fill={palette.wash}
          filter="url(#whiteboard-glow)"
        />
        <ellipse
          cx={primitive.x}
          cy={primitive.y}
          rx={spotlightRadiusX * 0.72}
          ry={spotlightRadiusY * 0.72}
          fill="none"
          stroke="transparent"
        />
        <RoughInk
          className={className}
          drawables={[
            whiteboardInk.ellipse(
              primitive.x,
              primitive.y,
              spotlightRadiusX * 1.44,
              spotlightRadiusY * 1.44,
              inkOptions,
            ),
          ]}
          opacity={opacity}
          style={style}
        />
      </g>
    );
  }
  return null;
}

function RoughInk({
  drawables,
  className,
  style,
  opacity,
}: {
  drawables: RoughDrawable[];
  className: string;
  style: CSSProperties;
  opacity: number;
}) {
  const paths = drawables.flatMap((drawable) =>
    whiteboardInk.toPaths(drawable).map((path) => ({
      path,
      dash: drawable.options.strokeLineDash,
      dashOffset: drawable.options.strokeLineDashOffset,
    })),
  );
  return (
    <g className={className} style={style} opacity={opacity}>
      {paths.map(({ path, dash, dashOffset }) => (
        <path
          d={path.d}
          fill={path.fill ?? "none"}
          key={`${path.stroke}-${path.fill ?? "none"}-${path.d}`}
          stroke={path.stroke}
          strokeDasharray={dash?.join(" ")}
          strokeDashoffset={dashOffset}
          strokeWidth={path.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function roughArrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: RoughInkOptions,
): RoughDrawable {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = 14;
  const spread = 0.56;
  const arrowOptions = { ...options };
  delete arrowOptions.fill;
  return whiteboardInk.linearPath(
    [
      [x2 - length * Math.cos(angle - spread), y2 - length * Math.sin(angle - spread)],
      [x2, y2],
      [x2 - length * Math.cos(angle + spread), y2 - length * Math.sin(angle + spread)],
    ],
    { ...arrowOptions, preserveVertices: true },
  );
}

function WhiteboardText({
  primitive,
  layout,
  source,
  contrastMap,
  current,
  previous,
  order,
}: {
  primitive: LessonPrimitive;
  layout: WhiteboardTextLayout | undefined;
  source: SourceRect;
  contrastMap?: ScreenContrastMap;
  current: boolean;
  previous: boolean;
  order: number;
}) {
  const palette = whiteboardPalette(primitive, order);
  const surface = whiteboardTextSurface(primitive, layout, source, contrastMap);
  const style = {
    left: layout?.left ?? 12,
    top: layout?.centerY ?? 32,
    width: layout?.width ?? 220,
    "--whiteboard-delay": `${Math.min(order * 75, 450)}ms`,
    "--whiteboard-accent": palette.color,
  } as CSSProperties;
  return (
    <span
      className={`whiteboard-text whiteboard-${primitive.kind} surface-${surface}${previous && !current ? " previous" : ""}${current ? " current" : ""}`}
      data-surface={surface}
      style={style}
    >
      {primitive.text ?? ""}
    </span>
  );
}

function TeachingCursor({
  target,
  from,
  source,
  reducedMotion,
}: {
  target: { x: number; y: number };
  from?: { x: number; y: number };
  source: SourceRect;
  reducedMotion: boolean;
}) {
  const left = source.left + (target.x / 1000) * source.width;
  const top = source.top + (target.y / 1000) * source.height;
  const fromLeft = from ? source.left + (from.x / 1000) * source.width : left - 72;
  const fromTop = from ? source.top + (from.y / 1000) * source.height : top + 48;
  const style = {
    left,
    top,
    "--cursor-from-x": `${fromLeft - left}px`,
    "--cursor-from-y": `${fromTop - top}px`,
  } as CSSProperties;
  return (
    <div
      aria-hidden="true"
      className={`teaching-cursor${reducedMotion ? " reduced-motion" : ""}`}
      style={style}
    >
      <svg className="teaching-cursor-pointer" viewBox="0 0 16 22" aria-hidden="true">
        <path
          d="M2 1.5v16.1l4.05-3.6 3.05 6.45 2.65-1.25-3.05-6.4 5.55-.3L2 1.5Z"
          fill="#f8fafc"
          stroke="#111318"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function teachingCursorTarget(
  primitives: LessonPrimitive[],
  currentIds: ReadonlySet<string>,
): { x: number; y: number } | undefined {
  const target = teachingCursorPrimitive(primitives, currentIds);
  if (!target) return undefined;
  const lastPoint = target.points?.at(-1);
  if (["arrow", "curved-arrow", "vector", "line", "axis", "path"].includes(target.kind)) {
    return {
      x: clamp(target.x2 ?? lastPoint?.x ?? target.x, 0, 1000),
      y: clamp(target.y2 ?? lastPoint?.y ?? target.y, 0, 1000),
    };
  }
  if (["highlight", "rect", "circle", "spotlight", "point", "bracket"].includes(target.kind)) {
    return {
      x: clamp(target.x + (target.width ?? 0) / 2, 0, 1000),
      y: clamp(target.y + (target.height ?? 0) / 2, 0, 1000),
    };
  }
  return { x: clamp(target.x, 0, 1000), y: clamp(target.y, 0, 1000) };
}

function teachingCursorPrimitive(
  primitives: LessonPrimitive[],
  currentIds: ReadonlySet<string>,
): LessonPrimitive | undefined {
  const current = primitives.filter((primitive) => currentIds.has(primitive.id));
  const relationship = [...current]
    .reverse()
    .find((primitive) =>
      ["arrow", "curved-arrow", "vector", "line", "axis", "path"].includes(primitive.kind),
    );
  if (relationship) return relationship;
  const focus = [...current]
    .reverse()
    .find((primitive) =>
      ["highlight", "rect", "circle", "spotlight", "point", "bracket"].includes(primitive.kind),
    );
  return focus ?? current.at(-1);
}

function whiteboardTextSurface(
  primitive: LessonPrimitive,
  layout: WhiteboardTextLayout | undefined,
  source: SourceRect,
  contrastMap?: ScreenContrastMap,
): "halo" | "soft" | "plate" {
  if (primitive.kind === "callout") return "plate";
  const text = (primitive.text ?? "").trim();
  const compact = text.length <= 22 && !text.includes("\n");
  // Numbered teaching labels commonly sit directly beside source text or code.
  // Give only the glyph-sized label a quiet surface so the number and caption do
  // not visually merge with the material underneath.
  const enumerated = /^(?:step\s*)?\d+[.)\s:-]/i.test(text);
  if (primitive.kind === "label" && enumerated) return "soft";
  const fallback =
    primitive.kind === "equation"
      ? text.length <= 54
        ? "halo"
        : text.length <= 96
          ? "soft"
          : "plate"
      : compact
        ? "halo"
        : text.length <= 48
          ? "soft"
          : "plate";
  const sample = sampleScreenContrast(layout, source, contrastMap);
  if (!sample) return fallback;
  if (sample.mean >= 0.64 || sample.range >= 0.34) {
    return text.length <= 36 ? "soft" : "plate";
  }
  if (sample.mean <= 0.34 && sample.range <= 0.24) {
    return compact ? "halo" : "soft";
  }
  return fallback === "halo" ? "soft" : fallback;
}

function sampleScreenContrast(
  layout: LayoutRect | undefined,
  source: SourceRect,
  map: ScreenContrastMap | undefined,
): { mean: number; range: number } | undefined {
  if (!layout || !map || map.columns < 1 || map.rows < 1 || map.luminance.length === 0) {
    return undefined;
  }
  const normalizedLeft = (layout.left - source.left) / Math.max(1, source.width);
  const normalizedRight = (layout.right - source.left) / Math.max(1, source.width);
  const normalizedTop = (layout.top - source.top) / Math.max(1, source.height);
  const normalizedBottom = (layout.bottom - source.top) / Math.max(1, source.height);
  const columnStart = Math.max(0, Math.floor(normalizedLeft * map.columns));
  const columnEnd = Math.min(map.columns - 1, Math.floor(normalizedRight * map.columns));
  const rowStart = Math.max(0, Math.floor(normalizedTop * map.rows));
  const rowEnd = Math.min(map.rows - 1, Math.floor(normalizedBottom * map.rows));
  if (columnStart > columnEnd || rowStart > rowEnd) return undefined;
  const values: number[] = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) {
      const value = map.luminance[row * map.columns + column];
      if (typeof value === "number" && Number.isFinite(value)) values.push(clamp(value, 0, 1));
    }
  }
  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, range: Math.max(...values) - Math.min(...values) };
}

function whiteboardPalette(primitive: LessonPrimitive, order: number): WhiteboardPaletteEntry {
  const requested = primitive.color?.trim().toLowerCase();
  const explicit = WHITEBOARD_PALETTE.find(
    (entry) => entry.id === requested || entry.color.toLowerCase() === requested,
  );
  if (explicit) return explicit;
  if (["highlight", "spotlight", "circle", "point"].includes(primitive.kind)) {
    return WHITEBOARD_PALETTE[1];
  }
  if (["axis", "bracket"].includes(primitive.kind)) return WHITEBOARD_PALETTE[2];
  if (primitive.kind === "equation") return WHITEBOARD_PALETTE[2];
  return (
    WHITEBOARD_PALETTE[Math.abs(hashText(primitive.id) + order) % WHITEBOARD_PALETTE.length] ??
    WHITEBOARD_PALETTE[0]
  );
}

function hashText(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return hash;
}

export function layoutWhiteboardText(
  primitives: LessonPrimitive[],
  source: SourceRect,
  viewport: Viewport,
  obstacles: LayoutRect[] = [],
  contrastMap?: ScreenContrastMap,
): Record<string, WhiteboardTextLayout> {
  const layouts: Record<string, WhiteboardTextLayout> = {};
  const placed: LayoutRect[] = [...obstacles];
  const margin = 12;
  const gap = 10;
  for (const primitive of primitives) {
    const intendedWidth = ((primitive.width ?? 300) / 1000) * source.width;
    const fontSize = whiteboardFontSize(primitive, viewport);
    const horizontalPadding = primitive.kind === "callout" ? 26 : 20;
    const longestLine = (primitive.text ?? "")
      .split("\n")
      .reduce((longest, line) => Math.max(longest, line.length), 0);
    const contentWidth = longestLine * fontSize * (primitive.kind === "equation" ? 0.62 : 0.56);
    const preferredWidth =
      primitive.kind === "callout"
        ? intendedWidth
        : primitive.kind === "label" && primitive.width === undefined
          ? contentWidth + horizontalPadding
          : Math.max(intendedWidth, contentWidth + horizontalPadding);
    const maximumWidth = primitive.kind === "equation" ? 640 : 440;
    const minimumWidth = primitive.kind === "label" ? 64 : 150;
    const width = Math.min(
      Math.max(80, viewport.width - margin * 2),
      Math.max(minimumWidth, Math.min(maximumWidth, preferredWidth)),
    );
    const height = estimateTextHeight(primitive, width, viewport);
    const desiredLeft = clamp(
      source.left + (primitive.x / 1000) * source.width,
      margin,
      Math.max(margin, viewport.width - width - margin),
    );
    const desiredCenterY = clamp(
      source.top + (primitive.y / 1000) * source.height,
      margin + height / 2,
      Math.max(margin + height / 2, viewport.height - margin - height / 2),
    );
    const candidates: Array<{ left: number; centerY: number }> = [
      { left: desiredLeft, centerY: desiredCenterY },
      { left: margin, centerY: desiredCenterY },
      { left: viewport.width - margin - width, centerY: desiredCenterY },
      { left: desiredLeft, centerY: margin + height / 2 },
      { left: desiredLeft, centerY: viewport.height - margin - height / 2 },
      { left: margin, centerY: margin + height / 2 },
      { left: margin, centerY: viewport.height - margin - height / 2 },
      { left: viewport.width - margin - width, centerY: margin + height / 2 },
      {
        left: viewport.width - margin - width,
        centerY: viewport.height - margin - height / 2,
      },
    ];
    for (const obstacle of placed) {
      candidates.push(
        { left: desiredLeft, centerY: obstacle.bottom + gap + height / 2 },
        { left: desiredLeft, centerY: obstacle.top - gap - height / 2 },
        { left: obstacle.right + gap, centerY: desiredCenterY },
        { left: obstacle.left - gap - width, centerY: desiredCenterY },
      );
    }
    const normalized = candidates
      .map((candidate) => ({
        left: clamp(candidate.left, margin, Math.max(margin, viewport.width - width - margin)),
        centerY: clamp(
          candidate.centerY,
          margin + height / 2,
          Math.max(margin + height / 2, viewport.height - margin - height / 2),
        ),
      }))
      .sort((a, b) => {
        const score = (candidate: { left: number; centerY: number }): number => {
          const rect = layoutRect(candidate.left, candidate.centerY, width, height);
          const sample = sampleScreenContrast(rect, source, contrastMap);
          const distance =
            Math.abs(candidate.left - desiredLeft) + Math.abs(candidate.centerY - desiredCenterY);
          if (!sample) return distance;
          // Prefer clean, low-detail writing space without letting the layout drift
          // far from the model-grounded target. A bright but uniform area is still
          // usable because the text surface can add a compact contrast backing.
          return distance * 0.34 + sample.range * 480 + Math.max(0, sample.mean - 0.8) * 42;
        };
        return score(a) - score(b);
      });
    const chosen = normalized.find((candidate) => {
      const rect = layoutRect(candidate.left, candidate.centerY, width, height);
      return placed.every((other) => !rectanglesOverlap(rect, other, gap));
    }) ??
      normalized[0] ?? { left: desiredLeft, centerY: desiredCenterY };
    const rect = layoutRect(chosen.left, chosen.centerY, width, height);
    layouts[primitive.id] = {
      ...rect,
      width,
      height,
      centerY: chosen.centerY,
    };
    placed.push(rect);
  }
  return layouts;
}

function estimateTextHeight(primitive: LessonPrimitive, width: number, viewport: Viewport): number {
  const fontSize = whiteboardFontSize(primitive, viewport);
  const horizontalPadding = primitive.kind === "callout" ? 26 : 20;
  const verticalPadding = primitive.kind === "callout" ? 19 : 15;
  const charactersPerLine = Math.max(
    7,
    Math.floor(Math.max(40, width - horizontalPadding) / (fontSize * 0.57)),
  );
  const lineCount = (primitive.text ?? "")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.max(fontSize * 1.25 + verticalPadding, lineCount * fontSize * 1.25 + verticalPadding);
}

function whiteboardAidObstacles(
  viewport: Viewport,
  aidOnLeft: boolean,
  simulationKind: NonNullable<LessonPlan["simulation"]>["kind"] | undefined,
  hasImage: boolean,
): LayoutRect[] {
  const hasSimulation = Boolean(simulationKind);
  if (!hasSimulation && !hasImage) return [];
  const compactCustom = simulationKind === "custom";
  const width = compactCustom
    ? Math.min(320, Math.max(220, viewport.width * 0.24))
    : hasSimulation
      ? Math.min(520, Math.max(280, viewport.width * 0.39))
      : Math.min(320, Math.max(180, viewport.width * 0.28));
  const height = compactCustom
    ? Math.min(320, viewport.height * 0.32)
    : hasSimulation
      ? Math.min(480, viewport.height * 0.55)
      : viewport.height * 0.45;
  const side = viewport.width * 0.03;
  const left = aidOnLeft ? side : viewport.width - side - width;
  const top = compactCustom
    ? viewport.height - viewport.height * 0.03 - height
    : viewport.height * (hasSimulation ? 0.17 : 0.18);
  return [{ left, top, right: left + width, bottom: top + height }];
}

/**
 * Put optional media or simulations on the side with fewer lesson targets. Using only
 * the crop midpoint made a full-screen selection choose essentially at random, which
 * could cover the source code even when the other half of the screen was empty.
 */
export function placeWhiteboardAidOnLeft(
  primitives: LessonPrimitive[],
  source: SourceRect,
  viewport: Viewport,
): boolean {
  if (primitives.length === 0) return source.left + source.width / 2 > viewport.width / 2;
  let leftWeight = 0;
  let rightWeight = 0;
  for (const primitive of primitives) {
    const normalizedCenter = primitiveCenterX(primitive);
    const screenCenter = source.left + (normalizedCenter / 1000) * source.width;
    if (screenCenter < viewport.width / 2) leftWeight += 1;
    else rightWeight += 1;
  }
  return leftWeight < rightWeight;
}

/**
 * A model can explicitly reserve part of the selected screen for a simulation.
 * Prefer that grounded region over guessing which screen corner looks emptiest;
 * the latter can place animation over titles or source text on dense pages.
 */
export function findGroundedSimulationHost(
  primitives: LessonPrimitive[],
): LessonPrimitive | undefined {
  return primitives
    .filter((primitive) => {
      if (!["rect", "highlight"].includes(primitive.kind)) return false;
      if (primitive.width === undefined || primitive.height === undefined) return false;
      if (primitive.width < 180 || primitive.height < 140) return false;
      const semanticHint = `${primitive.id} ${primitive.text ?? ""}`.toLowerCase();
      return /(?:^|[-_\s])(?:sim|simulation|canvas|stage|plot|graph|diagram|container)(?:$|[-_\s])/.test(
        semanticHint,
      );
    })
    .sort(
      (left, right) =>
        (right.width ?? 0) * (right.height ?? 0) - (left.width ?? 0) * (left.height ?? 0),
    )[0];
}

function groundedSimulationStyle(
  host: LessonPrimitive,
  source: SourceRect,
): CSSProperties | undefined {
  if (host.width === undefined || host.height === undefined) return undefined;
  const hostLeft = source.left + (host.x / 1_000) * source.width;
  const hostTop = source.top + (host.y / 1_000) * source.height;
  const hostWidth = (host.width / 1_000) * source.width;
  const hostHeight = (host.height / 1_000) * source.height;
  const aspectRatio = 800 / 440;
  let width = Math.min(hostWidth, 900);
  let height = width / aspectRatio;
  if (height > Math.min(hostHeight, 480)) {
    height = Math.min(hostHeight, 480);
    width = height * aspectRatio;
  }
  return {
    left: hostLeft + Math.max(0, (hostWidth - width) / 2),
    top: hostTop + Math.max(0, (hostHeight - height) / 2),
    width,
    height,
  };
}

function primitiveCenterX(primitive: LessonPrimitive): number {
  if (primitive.width !== undefined) return primitive.x + primitive.width / 2;
  if (primitive.x2 !== undefined) return (primitive.x + primitive.x2) / 2;
  const points = primitive.points;
  if (points && points.length > 0) {
    return points.reduce((sum, point) => sum + point.x, 0) / points.length;
  }
  return primitive.x;
}

function layoutRect(left: number, centerY: number, width: number, height: number): LayoutRect {
  return { left, top: centerY - height / 2, right: left + width, bottom: centerY + height / 2 };
}

function rectanglesOverlap(a: LayoutRect, b: LayoutRect, gap: number): boolean {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

function whiteboardFontSize(primitive: LessonPrimitive, viewport: Viewport): number {
  return primitive.kind === "equation"
    ? clamp(viewport.width * 0.017, 20, 34)
    : primitive.kind === "callout"
      ? clamp(viewport.width * 0.0105, 15, 21)
      : clamp(viewport.width * 0.0135, 17, 27);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isTextPrimitive(primitive: LessonPrimitive): boolean {
  return ["label", "equation", "callout"].includes(primitive.kind);
}

export function projectSourceRect(
  geometry: LessonContextGeometry | undefined,
  viewport: Viewport,
): SourceRect {
  if (!geometry) return { left: 0, top: 0, width: viewport.width, height: viewport.height };
  const fullPixelWidth = Math.max(1, geometry.capturePixelWidth);
  const fullPixelHeight = Math.max(1, geometry.capturePixelHeight);
  const left = (geometry.cropBounds.x / fullPixelWidth) * viewport.width;
  const top = (geometry.cropBounds.y / fullPixelHeight) * viewport.height;
  const width = (geometry.cropBounds.width / fullPixelWidth) * viewport.width;
  const height = (geometry.cropBounds.height / fullPixelHeight) * viewport.height;
  return {
    left: Math.max(0, Math.min(viewport.width - 1, left)),
    top: Math.max(0, Math.min(viewport.height - 1, top)),
    width: Math.max(1, Math.min(viewport.width - left, width)),
    height: Math.max(1, Math.min(viewport.height - top, height)),
  };
}

function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    width: typeof window === "undefined" ? 1920 : Math.max(1, window.innerWidth),
    height: typeof window === "undefined" ? 1080 : Math.max(1, window.innerHeight),
  }));
  useEffect(() => {
    const update = (): void =>
      setViewport({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return viewport;
}
