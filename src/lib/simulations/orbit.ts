export interface OrbitInput {
  gravitationalParameter: number;
  planetRadius: number;
  initialAltitude: number;
  initialVelocity: number;
  duration: number;
  steps: number;
}

export interface OrbitSample {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  specificEnergy: number;
}

export type OrbitOutcome = "impact" | "bound-orbit" | "escape";

export interface OrbitResult {
  samples: OrbitSample[];
  outcome: OrbitOutcome;
  circularVelocity: number;
  escapeVelocity: number;
  eccentricity: number;
}

function acceleration(mu: number, x: number, y: number): [number, number] {
  const radiusSquared = x * x + y * y;
  const radius = Math.sqrt(radiusSquared);
  const scale = -mu / (radiusSquared * radius);
  return [scale * x, scale * y];
}

export function simulateOrbit(input: OrbitInput): OrbitResult {
  const { gravitationalParameter: mu, planetRadius, initialAltitude, initialVelocity } = input;
  if (
    !Number.isFinite(mu) ||
    !Number.isFinite(planetRadius) ||
    !Number.isFinite(initialAltitude) ||
    !Number.isFinite(initialVelocity) ||
    mu <= 0 ||
    planetRadius <= 0 ||
    initialAltitude <= 0 ||
    initialVelocity < 0 ||
    input.steps < 2 ||
    input.duration <= 0
  ) {
    throw new Error("Orbit inputs must be finite and physically valid");
  }

  const initialRadius = planetRadius + initialAltitude;
  const circularVelocity = Math.sqrt(mu / initialRadius);
  const escapeVelocity = Math.sqrt((2 * mu) / initialRadius);
  const angularMomentum = initialRadius * initialVelocity;
  const initialEnergy = initialVelocity ** 2 / 2 - mu / initialRadius;
  const eccentricity = Math.sqrt(
    Math.max(0, 1 + (2 * initialEnergy * angularMomentum ** 2) / mu ** 2),
  );
  const dt = input.duration / input.steps;
  let x = initialRadius;
  let y = 0;
  let vx = 0;
  let vy = initialVelocity;
  let [ax, ay] = acceleration(mu, x, y);
  const samples: OrbitSample[] = [];
  let impacted = false;

  for (let index = 0; index <= input.steps; index += 1) {
    const radius = Math.hypot(x, y);
    const speed = Math.hypot(vx, vy);
    samples.push({
      time: index * dt,
      x,
      y,
      vx,
      vy,
      radius,
      speed,
      specificEnergy: speed ** 2 / 2 - mu / radius,
    });

    if (radius <= planetRadius) {
      impacted = true;
      break;
    }

    x += vx * dt + 0.5 * ax * dt * dt;
    y += vy * dt + 0.5 * ay * dt * dt;
    const [nextAx, nextAy] = acceleration(mu, x, y);
    vx += 0.5 * (ax + nextAx) * dt;
    vy += 0.5 * (ay + nextAy) * dt;
    ax = nextAx;
    ay = nextAy;
  }

  const outcome: OrbitOutcome = impacted ? "impact" : initialEnergy >= 0 ? "escape" : "bound-orbit";
  return { samples, outcome, circularVelocity, escapeVelocity, eccentricity };
}

export function orbitPathToViewport(samples: OrbitSample[], width: number, height: number) {
  if (samples.length === 0) return [];
  const maxRadius = Math.max(...samples.map((sample) => Math.hypot(sample.x, sample.y)), 1);
  const scale = (Math.min(width, height) * 0.43) / maxRadius;
  return samples.map((sample) => ({
    x: width / 2 + sample.x * scale,
    y: height / 2 + sample.y * scale,
  }));
}
