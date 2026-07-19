import { useEffect, useMemo, useRef, useState } from "react";
import {
  circuitValues,
  sampleFunction,
  simulateProjectile,
  trigValues,
} from "../../../shared/simulations/math";
import { orbitPathToViewport, simulateOrbit } from "../../../shared/simulations/orbit";
import type {
  ControlSpec,
  LessonPlan,
  LessonPrimitive,
  SimulationSpec,
} from "../../../shared/types";

export function LessonCanvas({
  plan,
  stepIndex,
  reducedMotion,
}: {
  plan: LessonPlan;
  stepIndex: number;
  reducedMotion: boolean;
}) {
  const visibleIds = useMemo(
    () => new Set(plan.steps.slice(0, stepIndex + 1).flatMap((step) => step.primitiveIds)),
    [plan, stepIndex],
  );
  const primitives = plan.primitives.filter(
    (primitive) => !primitive.stepId || visibleIds.has(primitive.id),
  );
  return (
    <div className="lesson-visual-stack">
      {plan.simulation ? (
        <SimulationView
          simulation={plan.simulation}
          controls={plan.controls}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {primitives.length ? (
        <svg
          className={plan.simulation ? "lesson-primitives overlay" : "lesson-primitives"}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={plan.title}
        >
          <defs>
            <marker
              id="lesson-arrow"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 z" fill="context-stroke" />
            </marker>
            <filter id="soft-glow">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {primitives.map((primitive) => (
            <Primitive key={primitive.id} primitive={primitive} />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

function Primitive({ primitive }: { primitive: LessonPrimitive }) {
  const color = safeColor(primitive.color, "#a78bfa");
  const fill = safeColor(primitive.fill, "transparent");
  const strokeWidth = primitive.strokeWidth ?? 4;
  const lineProps = {
    stroke: color,
    strokeWidth,
    strokeDasharray: primitive.dashed ? "12 10" : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (primitive.kind === "circle" || primitive.kind === "point")
    return (
      <circle
        cx={primitive.x}
        cy={primitive.y}
        r={primitive.radius ?? (primitive.kind === "point" ? 8 : 70)}
        fill={fill}
        {...lineProps}
      />
    );
  if (primitive.kind === "rect" || primitive.kind === "highlight")
    return (
      <rect
        x={primitive.x}
        y={primitive.y}
        width={primitive.width ?? 120}
        height={primitive.height ?? 80}
        rx={primitive.kind === "highlight" ? 20 : 10}
        fill={primitive.kind === "highlight" ? withAlpha(color, 0.16) : fill}
        {...lineProps}
      />
    );
  if (primitive.kind === "line" || primitive.kind === "arrow" || primitive.kind === "vector")
    return (
      <line
        x1={primitive.x}
        y1={primitive.y}
        x2={primitive.x2 ?? primitive.x + 100}
        y2={primitive.y2 ?? primitive.y}
        markerEnd={primitive.kind === "line" ? undefined : "url(#lesson-arrow)"}
        {...lineProps}
      />
    );
  if (primitive.kind === "curved-arrow") {
    const x2 = primitive.x2 ?? primitive.x + 140;
    const y2 = primitive.y2 ?? primitive.y;
    const midX = (primitive.x + x2) / 2;
    const midY = Math.min(primitive.y, y2) - Math.max(50, Math.abs(x2 - primitive.x) * 0.28);
    return (
      <path
        d={"M " + primitive.x + " " + primitive.y + " Q " + midX + " " + midY + " " + x2 + " " + y2}
        fill="none"
        markerEnd="url(#lesson-arrow)"
        {...lineProps}
      />
    );
  }
  if (primitive.kind === "path")
    return (
      <polyline
        points={(primitive.points ?? []).map((point) => point.x + "," + point.y).join(" ")}
        fill="none"
        {...lineProps}
      />
    );
  if (primitive.kind === "axis")
    return (
      <g {...lineProps}>
        <line
          x1={primitive.x}
          y1={primitive.y2 ?? 850}
          x2={primitive.x}
          y2={primitive.y ?? 150}
          markerEnd="url(#lesson-arrow)"
        />
        <line
          x1={primitive.x ?? 150}
          y1={primitive.y}
          x2={primitive.x2 ?? 850}
          y2={primitive.y}
          markerEnd="url(#lesson-arrow)"
        />
      </g>
    );
  if (primitive.kind === "spotlight")
    return (
      <g>
        <circle
          cx={primitive.x}
          cy={primitive.y}
          r={primitive.radius ?? 100}
          fill={withAlpha(color, 0.18)}
          filter="url(#soft-glow)"
        />
        <circle
          cx={primitive.x}
          cy={primitive.y}
          r={(primitive.radius ?? 100) * 0.65}
          fill="none"
          {...lineProps}
        />
      </g>
    );
  if (primitive.kind === "bracket")
    return (
      <path
        d={
          "M " + primitive.x + " " + primitive.y + " h -18 v " + (primitive.height ?? 140) + " h 18"
        }
        fill="none"
        {...lineProps}
      />
    );
  const text = primitive.text ?? "";
  if (primitive.kind === "callout")
    return (
      <g>
        <rect
          x={primitive.x}
          y={primitive.y}
          width={primitive.width ?? 220}
          height={primitive.height ?? 90}
          rx="18"
          fill="rgba(10,12,20,.86)"
          {...lineProps}
        />
        <WrappedText
          text={text}
          x={primitive.x + 18}
          y={primitive.y + 34}
          width={primitive.width ?? 220}
          color={color}
        />
      </g>
    );
  return (
    <WrappedText
      text={text}
      x={primitive.x}
      y={primitive.y}
      width={primitive.width ?? 320}
      color={color}
      equation={primitive.kind === "equation"}
    />
  );
}

function WrappedText({
  text,
  x,
  y,
  width,
  color,
  equation = false,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  color: string;
  equation?: boolean;
}) {
  const size = equation ? 34 : 26;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  const maxCharacters = Math.max(8, Math.floor(width / (size * 0.56)));
  for (const word of words) {
    if ((line + " " + word).trim().length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={size}
      fontWeight={equation ? 650 : 560}
      fontFamily={equation ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "inherit"}
    >
      {lines.slice(0, 5).map((value, index) => (
        <tspan x={x} dy={index === 0 ? 0 : size * 1.25} key={value + "-" + x + "-" + y}>
          {value}
        </tspan>
      ))}
    </text>
  );
}

function SimulationView({
  simulation,
  controls,
  reducedMotion,
}: {
  simulation: SimulationSpec;
  controls: ControlSpec[];
  reducedMotion: boolean;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(controls.map((control) => [control.bind, control.value])),
  );
  useEffect(
    () => setValues(Object.fromEntries(controls.map((control) => [control.bind, control.value]))),
    [controls],
  );
  const live = { ...simulation, ...values } as SimulationSpec;
  return (
    <div className="simulation-shell">
      <SimulationGraphic simulation={live} reducedMotion={reducedMotion} />
      {controls.length ? (
        <div className="simulation-controls">
          {controls.map((control) => (
            <label key={control.id}>
              <span>
                <strong>{control.label}</strong>
                <em>
                  {formatControl(values[control.bind] ?? control.value)}
                  {control.unit ? " " + control.unit : ""}
                </em>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={values[control.bind] ?? control.value}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [control.bind]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SimulationGraphic({
  simulation,
  reducedMotion,
}: {
  simulation: SimulationSpec;
  reducedMotion: boolean;
}) {
  const time = useAnimationTime(reducedMotion);
  try {
    if (simulation.kind === "orbit") {
      const radius = simulation.planetRadius + simulation.initialAltitude;
      const period = 2 * Math.PI * Math.sqrt(radius ** 3 / simulation.gravitationalParameter);
      const result = simulateOrbit({
        ...simulation,
        duration: Math.min(period * 1.35, 200_000),
        steps: 280,
      });
      const path = orbitPathToViewport(result.samples, 800, 440);
      const index = Math.floor((time / 22) % Math.max(1, path.length));
      const satellite = path[index] ?? path[0] ?? { x: 610, y: 220 };
      const planetRadius = Math.max(
        38,
        (190 * simulation.planetRadius) /
          Math.max(...result.samples.map((sample) => sample.radius), simulation.planetRadius),
      );
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive orbit simulation"
        >
          <defs>
            <radialGradient id="planet">
              <stop offset="0" stopColor="#7de5ff" />
              <stop offset=".7" stopColor="#5266cb" />
              <stop offset="1" stopColor="#25285e" />
            </radialGradient>
            <filter id="sat-glow">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          <circle cx="400" cy="220" r={planetRadius + 25} fill="rgba(95,112,255,.08)" />
          <circle cx="400" cy="220" r={planetRadius} fill="url(#planet)" />
          <polyline
            points={path.map((point) => point.x + "," + point.y).join(" ")}
            fill="none"
            stroke={
              result.outcome === "impact"
                ? "#ff876f"
                : result.outcome === "escape"
                  ? "#ffd166"
                  : "#a78bfa"
            }
            strokeWidth="2.5"
            opacity=".8"
          />
          <circle
            cx={satellite.x}
            cy={satellite.y}
            r="14"
            fill="rgba(167,139,250,.3)"
            filter="url(#sat-glow)"
          />
          <circle cx={satellite.x} cy={satellite.y} r="6" fill="#f5f2ff" />
          <text x="24" y="36" className="sim-label">
            {result.outcome.replace("-", " ")} · v / circular{" "}
            {formatControl(simulation.initialVelocity / result.circularVelocity)}
          </text>
        </svg>
      );
    }
    if (simulation.kind === "projectile") {
      const points = simulateProjectile(simulation, 20, 240);
      const maxX = Math.max(...points.map((point) => point.x), 1);
      const maxY = Math.max(...points.map((point) => point.y), 1);
      const mapped = points.map((point) => ({
        x: 70 + (point.x / maxX) * 660,
        y: 370 - (point.y / maxY) * 290,
      }));
      const item = mapped[Math.floor((time / 22) % Math.max(1, mapped.length))] ??
        mapped[0] ?? { x: 70, y: 370 };
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive projectile simulation"
        >
          <line x1="40" y1="370" x2="760" y2="370" stroke="#39404f" strokeWidth="2" />
          <polyline
            points={mapped.map((point) => point.x + "," + point.y).join(" ")}
            fill="none"
            stroke="#79e4f2"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
          <circle cx={item.x} cy={item.y} r="10" fill="#c9ff61" />
          <line
            x1="70"
            y1="370"
            x2={70 + Math.cos((simulation.angleDegrees * Math.PI) / 180) * 80}
            y2={370 - Math.sin((simulation.angleDegrees * Math.PI) / 180) * 80}
            stroke="#a78bfa"
            strokeWidth="4"
            markerEnd="url(#sim-arrow)"
          />
          <text x="24" y="36" className="sim-label">
            trajectory · {simulation.angleDegrees.toFixed(0)}°
          </text>
        </svg>
      );
    }
    if (simulation.kind === "trigonometry") {
      const values = trigValues(simulation);
      const angle = values.radians;
      const x = 205 + Math.cos(angle) * 120;
      const y = 220 - Math.sin(angle) * 120;
      const wave = Array.from({ length: 180 }, (_, index) => {
        const t = (index / 179) * Math.PI * 4;
        const fn =
          simulation.function === "sin"
            ? Math.sin
            : simulation.function === "cos"
              ? Math.cos
              : Math.tan;
        const raw = fn(simulation.frequency * t + simulation.phase);
        return { x: 390 + (index / 179) * 370, y: 220 - Math.max(-2, Math.min(2, raw)) * 70 };
      });
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive trigonometry simulation"
        >
          <circle cx="205" cy="220" r="120" fill="none" stroke="#33394a" strokeWidth="2" />
          <line x1="205" y1="220" x2={x} y2={y} stroke="#a78bfa" strokeWidth="4" />
          <line x1={x} y1={y} x2={x} y2="220" stroke="#79e4f2" strokeDasharray="6 6" />
          <circle cx={x} cy={y} r="8" fill="#c9ff61" />
          <line x1="390" y1="220" x2="760" y2="220" stroke="#33394a" />
          <polyline
            points={wave.map((point) => point.x + "," + point.y).join(" ")}
            fill="none"
            stroke="#79e4f2"
            strokeWidth="3"
          />
          <text x="24" y="36" className="sim-label">
            {simulation.function}({simulation.angleDegrees.toFixed(0)}°) ·{" "}
            {formatControl(values[simulation.function])}
          </text>
        </svg>
      );
    }
    if (simulation.kind === "wave") {
      const wave = Array.from({ length: 220 }, (_, index) => {
        const ratio = index / 219;
        const x = ratio * simulation.wavelength * 2.5;
        const y =
          simulation.amplitude *
          Math.sin(
            2 * Math.PI * (x / simulation.wavelength - (simulation.frequency * time) / 1000) +
              simulation.phase,
          );
        return { x: 45 + ratio * 710, y: 220 - (y / Math.max(simulation.amplitude, 1)) * 120 };
      });
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive wave simulation"
        >
          <line x1="40" y1="220" x2="760" y2="220" stroke="#33394a" />
          <polyline
            points={wave.map((point) => point.x + "," + point.y).join(" ")}
            fill="none"
            stroke="#79e4f2"
            strokeWidth="4"
          />
          <text x="24" y="36" className="sim-label">
            wave speed · {formatControl(simulation.frequency * simulation.wavelength)}
          </text>
        </svg>
      );
    }
    if (simulation.kind === "circuit") {
      const values = circuitValues(simulation);
      const pulse = 1 + Math.sin(time / 220) * 0.12;
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive circuit simulation"
        >
          <path d="M150 110 H650 V330 H150 Z" fill="none" stroke="#4b5264" strokeWidth="5" />
          <line x1="150" y1="185" x2="150" y2="255" stroke="#f5f2ff" strokeWidth="8" />
          <line x1="175" y1="200" x2="175" y2="240" stroke="#f5f2ff" strokeWidth="4" />
          <path
            d="M330 110 l20 -28 35 56 35 -56 35 56 20 -28"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="5"
          />
          <circle
            cx="650"
            cy="220"
            r={48 * pulse}
            fill="rgba(121,228,242,.08)"
            stroke="#79e4f2"
            strokeWidth="4"
          />
          <path
            d="M630 220 q20 -35 40 0 q-20 35 -40 0"
            fill="none"
            stroke="#c9ff61"
            strokeWidth="3"
          />
          <text x="24" y="36" className="sim-label">
            I = {formatControl(values.current)} A · P = {formatControl(values.power)} W
          </text>
          <text x="125" y="290" className="sim-caption">
            {simulation.voltage} V
          </text>
          <text x="357" y="75" className="sim-caption">
            {simulation.resistance} Ω
          </text>
        </svg>
      );
    }
    if (simulation.kind === "event-loop") {
      const index = Math.floor(time / 900) % Math.max(1, simulation.trace.length);
      const active = simulation.trace[index];
      const phases = ["script", "microtask", "task"] as const;
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive event loop simulation"
        >
          {phases.map((phase, phaseIndex) => (
            <g key={phase}>
              <rect
                x={45 + phaseIndex * 250}
                y="80"
                width="210"
                height="290"
                rx="20"
                fill={active?.phase === phase ? "rgba(167,139,250,.13)" : "rgba(255,255,255,.025)"}
                stroke={active?.phase === phase ? "#a78bfa" : "#303644"}
              />
              <text x={70 + phaseIndex * 250} y="120" className="sim-heading">
                {phase}
              </text>
              {simulation.trace
                .filter((item) => item.phase === phase)
                .slice(0, 5)
                .map((item, itemIndex) => (
                  <g key={item.id}>
                    <rect
                      x={65 + phaseIndex * 250}
                      y={145 + itemIndex * 42}
                      width="170"
                      height="30"
                      rx="8"
                      fill={item.id === active?.id ? "#a78bfa" : "#1b1f2a"}
                    />
                    <text x={76 + phaseIndex * 250} y={165 + itemIndex * 42} className="sim-item">
                      {item.label.slice(0, 23)}
                    </text>
                  </g>
                ))}
            </g>
          ))}
          <text x="24" y="36" className="sim-label">
            {active?.action ?? "trace"} · {active?.value ?? active?.label ?? "event loop"}
          </text>
        </svg>
      );
    }
    if (simulation.kind === "function-graph") {
      const samples = sampleFunction(simulation);
      const finiteY = samples.map((point) => point.y).filter(Number.isFinite);
      const minY = Math.min(...finiteY, -1);
      const maxY = Math.max(...finiteY, 1);
      const points = samples.map((point) => ({
        x: 55 + ((point.x - simulation.xMin) / (simulation.xMax - simulation.xMin)) * 690,
        y: 380 - ((point.y - minY) / Math.max(maxY - minY, 0.001)) * 320,
      }));
      return (
        <svg
          className="simulation-graphic"
          viewBox="0 0 800 440"
          role="img"
          aria-label="Interactive function graph"
        >
          <line x1="55" y1="220" x2="745" y2="220" stroke="#39404f" />
          <line x1="400" y1="55" x2="400" y2="380" stroke="#39404f" />
          <polyline
            points={points.map((point) => point.x + "," + point.y).join(" ")}
            fill="none"
            stroke="#c9ff61"
            strokeWidth="4"
          />
          <text x="24" y="36" className="sim-label">
            {simulation.expression} function · domain {simulation.xMin} to {simulation.xMax}
          </text>
        </svg>
      );
    }
    const duration = simulation.durationSeconds * 1000;
    const t = (time % duration) / 1000;
    return (
      <svg
        className="simulation-graphic"
        viewBox="0 0 1000 1000"
        role="img"
        aria-label="Interactive custom motion simulation"
      >
        {simulation.entities.map((entity) => {
          const motions = simulation.motions.filter((motion) => motion.entityId === entity.id);
          let x = entity.x;
          let y = entity.y;
          let rotation = 0;
          let scale = 1;
          for (const motion of motions) {
            const phase = motion.frequency * t * Math.PI * 2 + motion.phase;
            if (motion.kind === "orbit") {
              x += Math.cos(phase) * motion.amplitude;
              y += Math.sin(phase) * motion.amplitude;
            } else if (motion.kind === "oscillate-x") x += Math.sin(phase) * motion.amplitude;
            else if (motion.kind === "oscillate-y") y += Math.sin(phase) * motion.amplitude;
            else if (motion.kind === "rotate") rotation += (phase * 180) / Math.PI;
            else scale += Math.sin(phase) * Math.min(0.8, motion.amplitude / 100);
          }
          return (
            <g
              key={entity.id}
              transform={
                "translate(" + x + " " + y + ") rotate(" + rotation + ") scale(" + scale + ")"
              }
            >
              {entity.shape === "circle" ? (
                <circle r={entity.width / 2} fill={safeColor(entity.color, "#a78bfa")} />
              ) : entity.shape === "arrow" ? (
                <line
                  x1={-entity.width / 2}
                  y1="0"
                  x2={entity.width / 2}
                  y2="0"
                  stroke={safeColor(entity.color, "#a78bfa")}
                  strokeWidth={Math.max(3, entity.height)}
                  markerEnd="url(#lesson-arrow)"
                />
              ) : (
                <rect
                  x={-entity.width / 2}
                  y={-entity.height / 2}
                  width={entity.width}
                  height={entity.height}
                  rx="12"
                  fill={safeColor(entity.color, "#a78bfa")}
                />
              )}
              {entity.label ? (
                <text y={entity.height / 2 + 35} textAnchor="middle" className="sim-heading">
                  {entity.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  } catch (error) {
    return (
      <div className="simulation-error">
        This simulation could not render safely.{" "}
        {error instanceof Error ? error.message : "Invalid parameters"}
      </div>
    );
  }
}

function useAnimationTime(paused: boolean): number {
  const [time, setTime] = useState(0);
  const elapsed = useRef(0);
  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const start = performance.now() - elapsed.current;
    const tick = (now: number): void => {
      elapsed.current = now - start;
      setTime(elapsed.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  return time;
}

function safeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(value)
    ? value
    : fallback;
}
function withAlpha(color: string, alpha: number): string {
  return color.startsWith("#") && color.length === 7
    ? color +
        Math.round(alpha * 255)
          .toString(16)
          .padStart(2, "0")
    : color;
}
function formatControl(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) return value.toExponential(2);
  return Number(value.toFixed(3)).toString();
}
