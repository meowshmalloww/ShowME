import type { LessonPlan, LessonPrimitive } from "../lib/types";
import { SimulationViewport } from "./Simulations";

function PrimitiveShape({ primitive }: { primitive: LessonPrimitive }) {
  const color = primitive.color ?? "#dce8ff";
  const fill = primitive.fill ?? (primitive.kind === "highlight" ? "#ffe18a33" : "none");
  const strokeWidth = primitive.strokeWidth ?? 3;
  const shared = {
    stroke: color,
    strokeWidth,
    fill,
    strokeDasharray: primitive.dashed ? "10 8" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const x2 = primitive.x2 ?? primitive.x;
  const y2 = primitive.y2 ?? primitive.y;

  switch (primitive.kind) {
    case "circle":
    case "point":
      return (
        <circle
          {...shared}
          cx={primitive.x}
          cy={primitive.y}
          r={primitive.radius ?? (primitive.kind === "point" ? 7 : 36)}
        />
      );
    case "rect":
    case "highlight":
      return (
        <rect
          {...shared}
          x={primitive.x}
          y={primitive.y}
          width={primitive.width ?? 120}
          height={primitive.height ?? 80}
          rx={primitive.kind === "highlight" ? 12 : 5}
        />
      );
    case "line":
      return <line {...shared} x1={primitive.x} y1={primitive.y} x2={x2} y2={y2} />;
    case "arrow":
    case "vector":
      return (
        <line
          {...shared}
          x1={primitive.x}
          y1={primitive.y}
          x2={x2}
          y2={y2}
          markerEnd="url(#lesson-arrow)"
        />
      );
    case "path":
      return primitive.points && primitive.points.length > 1 ? (
        <polyline
          {...shared}
          points={primitive.points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
      ) : null;
    case "label":
    case "equation":
      return (
        <text
          x={primitive.x}
          y={primitive.y}
          fill={color}
          className={primitive.kind === "equation" ? "scene-equation" : "scene-label"}
          textAnchor="start"
        >
          {(primitive.text ?? "").slice(0, 240)}
        </text>
      );
  }
}

export function LessonRenderer({
  plan,
  activeStep,
  controlValues,
  paused,
  replayKey,
  reducedMotion,
}: {
  plan: LessonPlan;
  activeStep: number;
  controlValues: Record<string, number>;
  paused: boolean;
  replayKey: number;
  reducedMotion: boolean;
}) {
  const step = plan.steps[activeStep] ?? plan.steps[0];
  const visible = new Set(step?.primitiveIds ?? plan.primitives.map((primitive) => primitive.id));
  return (
    <section className="lesson-stage" aria-label={`Interactive visualization for ${plan.title}`}>
      <div className="stage-grid" />
      {plan.simulation && (
        <SimulationViewport
          key={`${plan.id}-${replayKey}`}
          simulation={plan.simulation}
          controls={controlValues}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      )}
      <svg
        className="scene-overlay"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <title>{`Lesson annotations for ${plan.title}`}</title>
        <defs>
          <marker
            id="lesson-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="context-stroke" />
          </marker>
        </defs>
        {plan.primitives.map((primitive) => (
          <g
            key={primitive.id}
            className={visible.has(primitive.id) ? "primitive-visible" : "primitive-hidden"}
          >
            <PrimitiveShape primitive={primitive} />
          </g>
        ))}
      </svg>
      <div className="stage-corner-label">
        <span className="status-live-dot" />
        {plan.simulation ? `${plan.simulation.kind.replace("-", " ")} lab` : "visual scene"}
      </div>
    </section>
  );
}
