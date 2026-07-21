import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type {
  ImageAsset,
  LessonContextGeometry,
  LessonPlan,
  LessonPrimitive,
} from "../../../shared/types";
import { SimulationGraphic } from "./LessonCanvas";

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
  { id: "cyan", color: "#65dcff", wash: "rgba(101, 220, 255, 0.16)" },
  { id: "amber", color: "#ffc857", wash: "rgba(255, 200, 87, 0.17)" },
  { id: "violet", color: "#b79cff", wash: "rgba(183, 156, 255, 0.17)" },
  { id: "mint", color: "#67e8b5", wash: "rgba(103, 232, 181, 0.16)" },
  { id: "coral", color: "#ff8b7b", wash: "rgba(255, 139, 123, 0.17)" },
] as const;

type WhiteboardPaletteEntry = (typeof WHITEBOARD_PALETTE)[number];

export interface WhiteboardTextLayout extends LayoutRect {
  width: number;
  height: number;
  centerY: number;
}

export function WhiteboardCanvas({
  plan,
  stepIndex,
  reducedMotion,
  contextGeometry,
  imageAsset,
  phase = "active",
}: {
  plan: LessonPlan;
  stepIndex: number;
  reducedMotion: boolean;
  contextGeometry?: LessonContextGeometry;
  imageAsset?: ImageAsset;
  phase?: "active" | "fading";
}) {
  const viewport = useViewport();
  const source = useMemo(
    () => projectSourceRect(contextGeometry, viewport),
    [contextGeometry, viewport],
  );
  const visibleIds = useMemo(
    () => new Set(plan.steps.slice(0, stepIndex + 1).flatMap((step) => step.primitiveIds)),
    [plan.steps, stepIndex],
  );
  const currentIds = useMemo(
    () => new Set(plan.steps[stepIndex]?.primitiveIds ?? []),
    [plan.steps, stepIndex],
  );
  const primitives = plan.primitives.filter(
    (primitive) => visibleIds.size === 0 || visibleIds.has(primitive.id),
  );
  const geometryPrimitives = primitives.filter((primitive) => !isTextPrimitive(primitive));
  const textPrimitives = primitives.filter(isTextPrimitive);
  const sourceStyle: CSSProperties = {
    left: source.left,
    top: source.top,
    width: source.width,
    height: source.height,
  };
  const aidOnLeft = source.left + source.width / 2 > viewport.width / 2;
  const aidObstacles = useMemo(
    () =>
      whiteboardAidObstacles(viewport, aidOnLeft, Boolean(plan.simulation), Boolean(imageAsset)),
    [aidOnLeft, imageAsset, plan.simulation, viewport],
  );
  const textLayouts = useMemo(
    () => layoutWhiteboardText(textPrimitives, source, viewport, aidObstacles),
    [aidObstacles, source, textPrimitives, viewport],
  );
  const cursorTarget = teachingCursorTarget(plan.primitives, currentIds);
  const previousIds = new Set(plan.steps[Math.max(0, stepIndex - 1)]?.primitiveIds ?? []);
  const previousCursorTarget =
    stepIndex > 0 ? teachingCursorTarget(plan.primitives, previousIds) : undefined;

  return (
    <main
      className={`whiteboard-overlay board-${phase}${reducedMotion ? " reduced-motion" : ""}`}
      aria-label={plan.title}
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
          {WHITEBOARD_PALETTE.map((entry) => (
            <marker
              id={`whiteboard-arrow-${entry.id}`}
              key={entry.id}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 z" fill={entry.color} />
            </marker>
          ))}
          <marker
            id="lesson-arrow"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#65dcff" />
          </marker>
          <marker
            id="sim-arrow"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="8"
            markerHeight="8"
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
          current={currentIds.has(primitive.id)}
          order={index}
        />
      ))}

      {plan.simulation ? (
        <section
          className={"whiteboard-simulation " + (aidOnLeft ? "aid-left" : "aid-right")}
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
    </main>
  );
}

function WhiteboardPrimitive({
  primitive,
  source,
  current,
  order,
}: {
  primitive: LessonPrimitive;
  source: SourceRect;
  current: boolean;
  order: number;
}) {
  const palette = whiteboardPalette(primitive, order);
  const strokeWidth = Math.max(2.5, primitive.strokeWidth ?? 5);
  const props = {
    className: `whiteboard-stroke${current ? " current" : ""}`,
    stroke: palette.color,
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
    strokeDasharray: primitive.dashed ? "12 10" : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: {
      "--whiteboard-delay": `${Math.min(order * 70, 420)}ms`,
      "--whiteboard-color": palette.color,
    } as CSSProperties,
  };
  const shortestSourceSide = Math.max(1, Math.min(source.width, source.height));
  const circleRadius = primitive.radius ?? (primitive.kind === "point" ? 9 : 72);
  const circleRadiusX = (circleRadius * shortestSourceSide) / Math.max(1, source.width);
  const circleRadiusY = (circleRadius * shortestSourceSide) / Math.max(1, source.height);
  if (primitive.kind === "circle" || primitive.kind === "point") {
    return (
      <ellipse
        cx={primitive.x}
        cy={primitive.y}
        rx={circleRadiusX}
        ry={circleRadiusY}
        fill={primitive.kind === "point" ? palette.color : palette.wash}
        {...props}
      />
    );
  }
  if (primitive.kind === "rect" || primitive.kind === "highlight") {
    return (
      <rect
        x={primitive.x}
        y={primitive.y}
        width={primitive.width ?? 140}
        height={primitive.height ?? 90}
        rx={primitive.kind === "highlight" ? 20 : 10}
        fill={primitive.kind === "highlight" ? palette.wash : "transparent"}
        {...props}
      />
    );
  }
  if (primitive.kind === "line" || primitive.kind === "arrow" || primitive.kind === "vector") {
    return (
      <line
        x1={primitive.x}
        y1={primitive.y}
        x2={primitive.x2 ?? primitive.x + 120}
        y2={primitive.y2 ?? primitive.y}
        markerEnd={
          primitive.kind === "line" ? undefined : `url(#whiteboard-arrow-${palette.id})`
        }
        {...props}
      />
    );
  }
  if (primitive.kind === "curved-arrow") {
    const x2 = primitive.x2 ?? primitive.x + 150;
    const y2 = primitive.y2 ?? primitive.y;
    const midX = (primitive.x + x2) / 2;
    const midY = Math.min(primitive.y, y2) - Math.max(55, Math.abs(x2 - primitive.x) * 0.28);
    return (
      <path
        d={`M ${primitive.x} ${primitive.y} Q ${midX} ${midY} ${x2} ${y2}`}
        fill="none"
        markerEnd={`url(#whiteboard-arrow-${palette.id})`}
        {...props}
      />
    );
  }
  if (primitive.kind === "path") {
    return (
      <polyline
        points={(primitive.points ?? []).map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        {...props}
      />
    );
  }
  if (primitive.kind === "axis") {
    return (
      <g {...props}>
        <line
          x1={primitive.x}
          y1={primitive.y2 ?? 850}
          x2={primitive.x}
          y2={primitive.y ?? 150}
          markerEnd={`url(#whiteboard-arrow-${palette.id})`}
        />
        <line
          x1={primitive.x}
          y1={primitive.y}
          x2={primitive.x2 ?? 850}
          y2={primitive.y}
          markerEnd={`url(#whiteboard-arrow-${palette.id})`}
        />
      </g>
    );
  }
  if (primitive.kind === "bracket") {
    return (
      <path
        d={`M ${primitive.x} ${primitive.y} h -18 v ${primitive.height ?? 140} h 18`}
        fill="none"
        {...props}
      />
    );
  }
  if (primitive.kind === "spotlight") {
    const spotlightRadius = primitive.radius ?? 100;
    const spotlightRadiusX = (spotlightRadius * shortestSourceSide) / Math.max(1, source.width);
    const spotlightRadiusY = (spotlightRadius * shortestSourceSide) / Math.max(1, source.height);
    return (
      <g className={current ? "whiteboard-spotlight current" : "whiteboard-spotlight"}>
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
          {...props}
        />
      </g>
    );
  }
  return null;
}

function WhiteboardText({
  primitive,
  layout,
  current,
  order,
}: {
  primitive: LessonPrimitive;
  layout: WhiteboardTextLayout | undefined;
  current: boolean;
  order: number;
}) {
  const palette = whiteboardPalette(primitive, order);
  const surface = whiteboardTextSurface(primitive);
  const style = {
    left: layout?.left ?? 12,
    top: layout?.centerY ?? 32,
    width: layout?.width ?? 220,
    "--whiteboard-delay": `${Math.min(order * 75, 450)}ms`,
    "--whiteboard-accent": palette.color,
  } as CSSProperties;
  return (
    <span
      className={`whiteboard-text whiteboard-${primitive.kind} surface-${surface}${current ? " current" : ""}`}
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
      <span className="teaching-cursor-ring" />
      <span className="teaching-cursor-pointer" />
    </div>
  );
}

export function teachingCursorTarget(
  primitives: LessonPrimitive[],
  currentIds: ReadonlySet<string>,
): { x: number; y: number } | undefined {
  const current = primitives.filter((primitive) => currentIds.has(primitive.id));
  const relationship = [...current]
    .reverse()
    .find((primitive) =>
      ["arrow", "curved-arrow", "vector", "line", "axis", "path"].includes(primitive.kind),
    );
  if (relationship) {
    const lastPoint = relationship.points?.at(-1);
    return {
      x: clamp(relationship.x2 ?? lastPoint?.x ?? relationship.x, 0, 1000),
      y: clamp(relationship.y2 ?? lastPoint?.y ?? relationship.y, 0, 1000),
    };
  }
  const focus = [...current]
    .reverse()
    .find((primitive) =>
      ["highlight", "rect", "circle", "spotlight", "point", "bracket"].includes(primitive.kind),
    );
  if (focus) {
    return {
      x: clamp(focus.x + (focus.width ?? 0) / 2, 0, 1000),
      y: clamp(focus.y + (focus.height ?? 0) / 2, 0, 1000),
    };
  }
  const text = current.at(-1);
  return text ? { x: clamp(text.x, 0, 1000), y: clamp(text.y, 0, 1000) } : undefined;
}

function whiteboardTextSurface(primitive: LessonPrimitive): "halo" | "soft" | "plate" {
  if (primitive.kind === "equation" || primitive.kind === "callout") return "plate";
  const text = (primitive.text ?? "").trim();
  if (text.length <= 22 && !text.includes("\n")) return "halo";
  return text.length <= 48 ? "soft" : "plate";
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
      .sort(
        (a, b) =>
          Math.abs(a.left - desiredLeft) +
          Math.abs(a.centerY - desiredCenterY) -
          (Math.abs(b.left - desiredLeft) + Math.abs(b.centerY - desiredCenterY)),
      );
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
  hasSimulation: boolean,
  hasImage: boolean,
): LayoutRect[] {
  if (!hasSimulation && !hasImage) return [];
  const width = hasSimulation
    ? Math.min(520, Math.max(280, viewport.width * 0.39))
    : Math.min(320, Math.max(180, viewport.width * 0.28));
  const height = hasSimulation ? Math.min(480, viewport.height * 0.55) : viewport.height * 0.45;
  const side = viewport.width * 0.03;
  const left = aidOnLeft ? side : viewport.width - side - width;
  const top = viewport.height * (hasSimulation ? 0.17 : 0.18);
  return [{ left, top, right: left + width, bottom: top + height }];
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
