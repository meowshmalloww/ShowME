import { useEffect, useMemo, useRef, useState } from "react";
import { orbitPathToViewport, simulateOrbit } from "../lib/simulations/orbit";
import type {
  CircuitSimulationSpec,
  CustomSimulationSpec,
  EventLoopSimulationSpec,
  FunctionGraphSimulationSpec,
  ProjectileSimulationSpec,
  SimulationSpec,
  TrigonometrySimulationSpec,
  WaveSimulationSpec,
} from "../lib/types";

const STARS = Array.from({ length: 28 }, (_, ordinal) => ({
  id: `star-${ordinal + 1}`,
  x: ((ordinal * 173) % 970) + 15,
  y: ((ordinal * 97) % 550) + 20,
  radius: ordinal % 4 === 0 ? 2 : 1,
}));
const CHARGE_IDS = [
  "charge-a",
  "charge-b",
  "charge-c",
  "charge-d",
  "charge-e",
  "charge-f",
  "charge-g",
  "charge-h",
  "charge-i",
] as const;

function useAnimationProgress(paused: boolean, reducedMotion: boolean, seconds = 6) {
  const [progress, setProgress] = useState(reducedMotion ? 0.55 : 0);
  const elapsed = useRef(0);
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (paused || reducedMotion) return;
    let frame = 0;
    const animate = (time: number) => {
      if (previous.current !== undefined) elapsed.current += (time - previous.current) / 1000;
      previous.current = time;
      setProgress((elapsed.current % seconds) / seconds);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      previous.current = undefined;
    };
  }, [paused, reducedMotion, seconds]);
  return progress;
}

function control(controls: Record<string, number>, bind: string, fallback: number) {
  const value = controls[bind];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function OrbitLab({
  spec,
  controls,
  paused,
  reducedMotion,
}: {
  spec: Extract<SimulationSpec, { kind: "orbit" }>;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const velocity = control(controls, "initialVelocity", spec.initialVelocity);
  const timeScale = control(controls, "timeScale", spec.timeScale);
  const result = useMemo(
    () =>
      simulateOrbit({
        gravitationalParameter: spec.gravitationalParameter,
        planetRadius: spec.planetRadius,
        initialAltitude: spec.initialAltitude,
        initialVelocity: velocity,
        duration: 12_000,
        steps: 900,
      }),
    [spec.gravitationalParameter, spec.planetRadius, spec.initialAltitude, velocity],
  );
  const path = useMemo(() => orbitPathToViewport(result.samples, 1000, 600), [result.samples]);
  const animationSeconds = Math.max(2.5, Math.min(12, 7800 / Math.max(1, timeScale)));
  const progress = useAnimationProgress(paused, reducedMotion, animationSeconds);
  const sampleIndex = Math.min(path.length - 1, Math.floor(progress * path.length));
  const satellite = path[sampleIndex] ?? path[0] ?? { x: 820, y: 300 };
  const maxRadius = Math.max(...result.samples.map((sample) => sample.radius), 1);
  const scale = (Math.min(1000, 600) * 0.43) / maxRadius;
  const planetRadius = Math.max(34, spec.planetRadius * scale);
  const pathData = path
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const outcomeLabel = {
    impact: "impact",
    "bound-orbit": "bound orbit",
    escape: "escape trajectory",
  }[result.outcome];

  return (
    <svg
      className="simulation-svg orbit-lab"
      viewBox="0 0 1000 600"
      role="img"
      aria-label={`Orbit simulation: ${outcomeLabel}`}
    >
      <defs>
        <radialGradient id="earth-fill" cx="35%" cy="30%">
          <stop offset="0" stopColor="#69d8ff" />
          <stop offset=".62" stopColor="#227ac7" />
          <stop offset="1" stopColor="#0f315f" />
        </radialGradient>
        <filter id="earth-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="14" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {STARS.map((star) => (
        <circle key={star.id} cx={star.x} cy={star.y} r={star.radius} className="star" />
      ))}
      {spec.showTrail && <path d={pathData} className={`orbit-path ${result.outcome}`} />}
      <circle cx="500" cy="300" r={planetRadius + 14} className="earth-halo" />
      <circle
        cx="500"
        cy="300"
        r={planetRadius}
        fill="url(#earth-fill)"
        filter="url(#earth-glow)"
      />
      <path
        d={`M${500 - planetRadius * 0.8} 290 Q500 250 ${500 + planetRadius * 0.75} 278`}
        className="earth-land"
      />
      <g transform={`translate(${satellite.x} ${satellite.y})`} className="satellite">
        <rect x="-14" y="-9" width="28" height="18" rx="4" />
        <rect x="-38" y="-7" width="20" height="14" rx="2" className="solar" />
        <rect x="18" y="-7" width="20" height="14" rx="2" className="solar" />
      </g>
      <g className="outcome-badge" transform="translate(36 42)">
        <rect width="205" height="53" rx="14" />
        <text x="18" y="22">
          CURRENT OUTCOME
        </text>
        <text x="18" y="42" className={result.outcome}>
          {outcomeLabel}
        </text>
      </g>
      <text x="970" y="565" textAnchor="end" className="sim-metric">
        v = {(velocity / 1000).toFixed(2)} km/s · circular ≈{" "}
        {(result.circularVelocity / 1000).toFixed(2)} km/s
      </text>
    </svg>
  );
}

function ProjectileLab({
  spec,
  controls,
  paused,
  reducedMotion,
}: {
  spec: ProjectileSimulationSpec;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const speed = control(controls, "speed", spec.speed);
  const angle = control(controls, "angleDegrees", spec.angleDegrees);
  const gravity = control(controls, "gravity", spec.gravity);
  const radians = (angle * Math.PI) / 180;
  const total = Math.max(
    0.4,
    (speed * Math.sin(radians) +
      Math.sqrt((speed * Math.sin(radians)) ** 2 + 2 * gravity * spec.initialHeight)) /
      gravity,
  );
  const points = Array.from({ length: 121 }, (_, index) => {
    const t = (total * index) / 120;
    return {
      x: speed * Math.cos(radians) * t,
      y: spec.initialHeight + speed * Math.sin(radians) * t - (gravity * t * t) / 2,
    };
  });
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  const mapped = points.map((point) => ({
    x: 90 + (point.x / maxX) * 830,
    y: 520 - (point.y / maxY) * 420,
  }));
  const progress = useAnimationProgress(paused, reducedMotion, 5);
  const current =
    mapped[Math.min(mapped.length - 1, Math.floor(progress * mapped.length))] ?? mapped[0];
  return (
    <svg className="simulation-svg projectile-lab" viewBox="0 0 1000 600">
      <title>Interactive projectile trajectory</title>
      <line x1="60" y1="520" x2="950" y2="520" className="axis" />
      <line x1="90" y1="540" x2="90" y2="70" className="axis" />
      <polyline
        points={mapped.map((point) => `${point.x},${point.y}`).join(" ")}
        className="projectile-path"
      />
      {current && <circle cx={current.x} cy={current.y} r="13" className="projectile" />}
      <text x="100" y="565" className="sim-metric">
        range ≈ {maxX.toFixed(1)} m
      </text>
      <text x="900" y="80" textAnchor="end" className="sim-metric">
        peak ≈ {maxY.toFixed(1)} m · {angle.toFixed(0)}°
      </text>
    </svg>
  );
}

function TrigLab({
  spec,
  controls,
  paused,
  reducedMotion,
}: {
  spec: TrigonometrySimulationSpec;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const animated = useAnimationProgress(paused, reducedMotion, 8) * 360;
  const angle =
    control(controls, "angleDegrees", spec.angleDegrees) + (paused || reducedMotion ? 0 : animated);
  const theta = ((angle + spec.phase) * Math.PI) / 180;
  const fn = spec.function === "sin" ? Math.sin : spec.function === "cos" ? Math.cos : Math.tan;
  const value = Math.max(-5, Math.min(5, spec.amplitude * fn(theta * spec.frequency)));
  const circleX = 250 + 145 * Math.cos(theta);
  const circleY = 300 - 145 * Math.sin(theta);
  const graphPoints = Array.from({ length: 301 }, (_, index) => {
    const x = (index / 300) * Math.PI * 4;
    const raw = Math.max(-2, Math.min(2, fn(x * spec.frequency + spec.phase)));
    return `${480 + (index / 300) * 465},${300 - raw * 105}`;
  }).join(" ");
  return (
    <svg className="simulation-svg trig-lab" viewBox="0 0 1000 600">
      <title>Unit circle and trigonometric function graph</title>
      <circle cx="250" cy="300" r="145" className="unit-circle" />
      <line x1="75" y1="300" x2="425" y2="300" className="axis" />
      <line x1="250" y1="125" x2="250" y2="475" className="axis" />
      <line x1="250" y1="300" x2={circleX} y2={circleY} className="radius-line" />
      <line x1={circleX} y1={circleY} x2={circleX} y2="300" className="projection-line" />
      <circle cx={circleX} cy={circleY} r="9" className="trig-point" />
      <line x1="480" y1="300" x2="955" y2="300" className="axis" />
      <line x1="480" y1="120" x2="480" y2="480" className="axis" />
      <polyline points={graphPoints} className="wave-path" />
      <text x="250" y="520" textAnchor="middle" className="sim-metric">
        θ = {(angle % 360).toFixed(0)}°
      </text>
      <text x="715" y="520" textAnchor="middle" className="sim-metric">
        {spec.function}(θ) = {value.toFixed(3)}
      </text>
    </svg>
  );
}

function WaveLab({
  spec,
  controls,
  paused,
  reducedMotion,
}: {
  spec: WaveSimulationSpec;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const progress = useAnimationProgress(paused, reducedMotion, 5);
  const amplitude = control(controls, "amplitude", spec.amplitude);
  const frequency = control(controls, "frequency", spec.frequency);
  const points = Array.from({ length: 400 }, (_, index) => {
    const x = index / 399;
    const y = Math.sin(
      x * Math.PI * 8 * (100 / Math.max(1, spec.wavelength)) -
        progress * Math.PI * 2 * frequency +
        spec.phase,
    );
    return `${70 + x * 860},${300 - y * Math.min(190, amplitude * 8)}`;
  }).join(" ");
  return (
    <svg className="simulation-svg wave-lab" viewBox="0 0 1000 600">
      <title>Interactive traveling wave</title>
      <line x1="50" y1="300" x2="950" y2="300" className="axis" />
      <polyline points={points} className="wave-path" />
      <text x="70" y="540" className="sim-metric">
        amplitude {amplitude.toFixed(2)} · frequency {frequency.toFixed(2)} Hz · wavelength{" "}
        {spec.wavelength.toFixed(2)}
      </text>
    </svg>
  );
}

function CircuitLab({
  spec,
  controls,
  paused,
  reducedMotion,
}: {
  spec: CircuitSimulationSpec;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const voltage = control(controls, "voltage", spec.voltage);
  const resistance = Math.max(0.0001, control(controls, "resistance", spec.resistance));
  const current = voltage / resistance;
  const progress = useAnimationProgress(
    paused,
    reducedMotion,
    Math.max(1, 5 / Math.min(5, Math.abs(current) + 0.2)),
  );
  const wire = "M170 185 H430 M570 185 H830 V425 H570 M430 425 H170 V185";
  return (
    <svg className="simulation-svg circuit-lab" viewBox="0 0 1000 600">
      <title>Interactive electrical circuit</title>
      <path d={wire} className="circuit-wire" />
      <line x1="430" y1="165" x2="430" y2="205" className="battery-short" />
      <line x1="455" y1="145" x2="455" y2="225" className="battery-long" />
      <path d="M455 185h35l12-25 25 50 18-50 25 25" className="resistor" />
      <circle cx="500" cy="425" r="74" className="circuit-load" />
      <path d="m458 425 22-35 40 70 22-35" className="resistor" />
      {CHARGE_IDS.map((id, index) => {
        const t = (progress + index / 9) % 1;
        const perimeter = 480 * 2 + 240 * 2;
        const d = t * perimeter;
        let x = 170;
        let y = 185;
        if (d < 660) x = 170 + d;
        else if (d < 900) {
          x = 830;
          y = 185 + d - 660;
        } else if (d < 1560) {
          x = 830 - (d - 900);
          y = 425;
        } else y = 425 - (d - 1560);
        return <circle key={id} cx={x} cy={y} r="7" className="charge" />;
      })}
      <text x="500" y="535" textAnchor="middle" className="sim-metric">
        I = V / R = {current.toPrecision(4)} A
      </text>
    </svg>
  );
}

function EventLoopLab({
  spec,
  paused,
  reducedMotion,
}: {
  spec: EventLoopSimulationSpec;
  paused: boolean;
  reducedMotion: boolean;
}) {
  const progress = useAnimationProgress(
    paused,
    reducedMotion,
    Math.max(5, spec.trace.length * 0.65),
  );
  const index = Math.min(spec.trace.length - 1, Math.floor(progress * spec.trace.length));
  const current = spec.trace[index];
  const output = spec.trace
    .slice(0, index + 1)
    .filter((traceStep) => traceStep.action === "log" && traceStep.value);
  return (
    <div className="event-loop-lab">
      <div className="code-card">
        <div className="lab-label">SOURCE</div>
        <pre>{spec.source}</pre>
      </div>
      <div className="loop-center">
        <div className={`loop-orb ${current?.phase ?? "script"}`}>{current?.phase ?? "script"}</div>
        <strong>{current?.label ?? "ready"}</strong>
        <span>{current?.value}</span>
      </div>
      <div className="queue-stack">
        <div>
          <span className="lab-label">MICROTASKS</span>
          {spec.trace
            .filter((step) => step.phase === "microtask" && step.action === "enqueue")
            .map((step) => (
              <small key={step.id}>{step.label}</small>
            ))}
        </div>
        <div>
          <span className="lab-label">TASKS</span>
          {spec.trace
            .filter((step) => step.phase === "task" && step.action === "enqueue")
            .map((step) => (
              <small key={step.id}>{step.label}</small>
            ))}
        </div>
        <div className="console-output">
          <span className="lab-label">CONSOLE</span>
          {output.map((traceStep) => (
            <small key={traceStep.id}>› {traceStep.value}</small>
          ))}
        </div>
      </div>
    </div>
  );
}

function FunctionGraphLab({
  spec,
  controls,
}: {
  spec: FunctionGraphSimulationSpec;
  controls: Record<string, number>;
}) {
  const a = control(controls, "a", spec.a);
  const b = control(controls, "b", spec.b);
  const c = control(controls, "c", spec.c);
  const fn = (x: number) => {
    if (spec.expression === "linear") return a * x + b;
    if (spec.expression === "quadratic") return a * x * x + b * x + c;
    if (spec.expression === "exponential")
      return a * Math.exp(Math.max(-20, Math.min(20, b * x))) + c;
    return Math.abs(x + b) < 1e-6 ? Number.NaN : a / (x + b) + c;
  };
  const raw = Array.from({ length: 500 }, (_, index) => {
    const x = spec.xMin + (index / 499) * (spec.xMax - spec.xMin);
    return { x, y: fn(x) };
  });
  const finiteY = raw
    .map((point) => point.y)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const bound = Math.max(
    1,
    Math.abs(finiteY[Math.floor(finiteY.length * 0.05)] ?? -10),
    Math.abs(finiteY[Math.floor(finiteY.length * 0.95)] ?? 10),
  );
  const segments: string[] = [];
  let path = "";
  raw.forEach((point) => {
    if (!Number.isFinite(point.y) || Math.abs(point.y) > bound * 2) {
      if (path) segments.push(path);
      path = "";
      return;
    }
    const x = 70 + ((point.x - spec.xMin) / (spec.xMax - spec.xMin)) * 860;
    const y = 300 - (point.y / bound) * 220;
    path += `${path ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `;
  });
  if (path) segments.push(path);
  const zeroX = 70 + ((0 - spec.xMin) / (spec.xMax - spec.xMin)) * 860;
  return (
    <svg className="simulation-svg function-lab" viewBox="0 0 1000 600">
      <title>Interactive mathematical function graph</title>
      <line x1="60" y1="300" x2="950" y2="300" className="axis" />
      <line x1={zeroX} y1="55" x2={zeroX} y2="545" className="axis" />
      {segments.map((segment) => (
        <path key={segment} d={segment} className="function-path" />
      ))}
      <text x="80" y="550" className="sim-metric">
        {spec.expression} · a={a.toFixed(2)} b={b.toFixed(2)} c={c.toFixed(2)}
      </text>
    </svg>
  );
}

function CustomLab({
  spec,
  reducedMotion,
}: {
  spec: CustomSimulationSpec;
  reducedMotion: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const send = () =>
      frame.current?.contentWindow?.postMessage(
        { type: "SHOWME_MOTION_SPEC", spec, reducedMotion },
        "*",
      );
    const node = frame.current;
    node?.addEventListener("load", send);
    send();
    return () => node?.removeEventListener("load", send);
  }, [spec, reducedMotion]);
  return (
    <iframe
      ref={frame}
      title="Sandboxed declarative motion"
      src="/sandbox.html"
      sandbox="allow-scripts"
      className="custom-motion-frame"
    />
  );
}

export function SimulationViewport({
  simulation,
  controls,
  paused,
  reducedMotion,
}: {
  simulation: SimulationSpec;
  controls: Record<string, number>;
  paused: boolean;
  reducedMotion: boolean;
}) {
  switch (simulation.kind) {
    case "orbit":
      return (
        <OrbitLab
          spec={simulation}
          controls={controls}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      );
    case "projectile":
      return (
        <ProjectileLab
          spec={simulation}
          controls={controls}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      );
    case "trigonometry":
      return (
        <TrigLab
          spec={simulation}
          controls={controls}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      );
    case "wave":
      return (
        <WaveLab
          spec={simulation}
          controls={controls}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      );
    case "circuit":
      return (
        <CircuitLab
          spec={simulation}
          controls={controls}
          paused={paused}
          reducedMotion={reducedMotion}
        />
      );
    case "event-loop":
      return <EventLoopLab spec={simulation} paused={paused} reducedMotion={reducedMotion} />;
    case "function-graph":
      return <FunctionGraphLab spec={simulation} controls={controls} />;
    case "custom":
      return <CustomLab spec={simulation} reducedMotion={reducedMotion} />;
  }
}
