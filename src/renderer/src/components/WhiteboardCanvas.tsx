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
          <marker
            id="whiteboard-arrow"
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

      {textPrimitives.map((primitive, index) => (
        <WhiteboardText
          key={primitive.id}
          primitive={primitive}
          source={source}
          viewport={viewport}
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
  const strokeWidth = Math.max(2.5, primitive.strokeWidth ?? 5);
  const props = {
    className: `whiteboard-stroke${current ? " current" : ""}`,
    stroke: "#65dcff",
    strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
    strokeDasharray: primitive.dashed ? "12 10" : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { "--whiteboard-delay": `${Math.min(order * 70, 420)}ms` } as CSSProperties,
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
        fill={primitive.kind === "point" ? "#ffffff" : "rgba(61, 202, 255, .06)"}
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
        fill={primitive.kind === "highlight" ? "rgba(51, 203, 255, .16)" : "transparent"}
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
        markerEnd={primitive.kind === "line" ? undefined : "url(#whiteboard-arrow)"}
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
        markerEnd="url(#whiteboard-arrow)"
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
          markerEnd="url(#whiteboard-arrow)"
        />
        <line
          x1={primitive.x}
          y1={primitive.y}
          x2={primitive.x2 ?? 850}
          y2={primitive.y}
          markerEnd="url(#whiteboard-arrow)"
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
          fill="rgba(57, 207, 255, .18)"
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
  source,
  viewport,
  current,
  order,
}: {
  primitive: LessonPrimitive;
  source: SourceRect;
  viewport: Viewport;
  current: boolean;
  order: number;
}) {
  const left = Math.max(
    12,
    Math.min(viewport.width - 120, source.left + (primitive.x / 1000) * source.width),
  );
  const top = Math.max(
    12,
    Math.min(viewport.height - 60, source.top + (primitive.y / 1000) * source.height),
  );
  const intendedWidth = ((primitive.width ?? 300) / 1000) * source.width;
  const width = Math.max(150, Math.min(440, intendedWidth));
  const style = {
    left,
    top,
    width,
    "--whiteboard-delay": `${Math.min(order * 75, 450)}ms`,
  } as CSSProperties;
  return (
    <span
      className={`whiteboard-text whiteboard-${primitive.kind}${current ? " current" : ""}`}
      style={style}
    >
      {primitive.text ?? ""}
    </span>
  );
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
