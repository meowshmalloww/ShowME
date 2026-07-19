import type {
  CircuitSimulationSpec,
  FunctionGraphSimulationSpec,
  ProjectileSimulationSpec,
  TrigonometrySimulationSpec,
  WaveSimulationSpec,
} from "../types";

export interface ProjectilePoint {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function simulateProjectile(
  spec: ProjectileSimulationSpec,
  duration = 12,
  steps = 180,
): ProjectilePoint[] {
  if (
    !Number.isFinite(spec.gravity) ||
    !Number.isFinite(spec.speed) ||
    spec.gravity <= 0 ||
    spec.speed < 0 ||
    steps < 2
  ) {
    throw new Error("Projectile inputs must be finite and physically valid");
  }
  const theta = (spec.angleDegrees * Math.PI) / 180;
  const dt = duration / steps;
  let x = 0;
  let y = spec.initialHeight;
  let vx = spec.speed * Math.cos(theta);
  let vy = spec.speed * Math.sin(theta);
  const points: ProjectilePoint[] = [];
  for (let index = 0; index <= steps; index += 1) {
    points.push({ time: index * dt, x, y: Math.max(0, y), vx, vy });
    if (y < 0 && index > 0) break;
    vy -= spec.gravity * dt;
    const speed = Math.hypot(vx, vy);
    const damping = 1 / (1 + spec.dragCoefficient * speed * dt);
    vx *= damping;
    vy *= damping;
    x += vx * dt;
    y += vy * dt;
  }
  return points;
}

export function trigValues(spec: TrigonometrySimulationSpec) {
  const radians = (spec.angleDegrees * Math.PI) / 180;
  const argument = spec.frequency * radians + spec.phase;
  return {
    radians,
    sin: spec.amplitude * Math.sin(argument),
    cos: spec.amplitude * Math.cos(argument),
    tan: spec.amplitude * Math.tan(argument),
  };
}

export function sampleWave(spec: WaveSimulationSpec, count = 120, time = 0) {
  if (count < 2 || spec.wavelength <= 0) throw new Error("Wave sample is invalid");
  return Array.from({ length: count }, (_, index) => {
    const x = index / (count - 1);
    const y =
      spec.amplitude *
      Math.sin(2 * Math.PI * (x / spec.wavelength - spec.frequency * time) + spec.phase);
    return { x, y };
  });
}

export function circuitValues(spec: CircuitSimulationSpec) {
  if (spec.resistance <= 0) throw new Error("Resistance must be positive");
  const current = spec.voltage / spec.resistance;
  const power = spec.voltage * current;
  const timeConstant = spec.resistance * spec.capacitance;
  return { current, power, timeConstant };
}

export function evaluateFunction(spec: FunctionGraphSimulationSpec, x: number): number {
  switch (spec.expression) {
    case "linear":
      return spec.a * x + spec.b;
    case "quadratic":
      return spec.a * x * x + spec.b * x + spec.c;
    case "exponential":
      return spec.a * Math.exp(spec.b * x) + spec.c;
    case "inverse":
      return spec.a / (x - spec.b) + spec.c;
  }
}

export function sampleFunction(spec: FunctionGraphSimulationSpec, count = 160) {
  if (count < 2 || spec.xMax <= spec.xMin) throw new Error("Function range is invalid");
  return Array.from({ length: count }, (_, index) => {
    const x = spec.xMin + ((spec.xMax - spec.xMin) * index) / (count - 1);
    return { x, y: evaluateFunction(spec, x) };
  }).filter((point) => Number.isFinite(point.y));
}
