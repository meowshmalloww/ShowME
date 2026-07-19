import { describe, expect, it } from "vitest";
import { consoleOrder, traceEventLoop } from "../src/shared/simulations/eventLoop";
import { circuitValues, simulateProjectile } from "../src/shared/simulations/math";
import { simulateOrbit } from "../src/shared/simulations/orbit";

describe("deterministic teaching modules", () => {
  it("classifies a near-circular low Earth orbit", () => {
    const result = simulateOrbit({
      gravitationalParameter: 3.986004418e14,
      planetRadius: 6_371_000,
      initialAltitude: 400_000,
      initialVelocity: 7670,
      duration: 5600,
      steps: 400,
    });
    expect(result.outcome).toBe("bound-orbit");
    expect(result.circularVelocity).toBeCloseTo(7672.6, 0);
    expect(result.samples.length).toBe(401);
  });

  it("models projectile range without executing arbitrary input", () => {
    const points = simulateProjectile({
      kind: "projectile",
      gravity: 9.81,
      speed: 20,
      angleDegrees: 45,
      initialHeight: 0,
      dragCoefficient: 0,
    });
    expect(Math.max(...points.map((point) => point.x))).toBeGreaterThan(35);
  });

  it("applies projectile drag without producing unstable motion", () => {
    const base = {
      kind: "projectile" as const,
      gravity: 9.81,
      speed: 30,
      angleDegrees: 42,
      initialHeight: 0,
    };
    const vacuum = simulateProjectile({ ...base, dragCoefficient: 0 }, 12, 720);
    const resisted = simulateProjectile({ ...base, dragCoefficient: 0.02 }, 12, 720);
    const vacuumRange = Math.max(...vacuum.map((point) => point.x));
    const resistedRange = Math.max(...resisted.map((point) => point.x));
    expect(resistedRange).toBeGreaterThan(0);
    expect(resistedRange).toBeLessThan(vacuumRange);
    expect(resisted.every((point) => Object.values(point).every(Number.isFinite))).toBe(true);
  });

  it("runs promise microtasks before timer tasks", () => {
    const trace = traceEventLoop(`
      console.log("sync");
      setTimeout(() => console.log("timer"));
      Promise.resolve().then(() => console.log("promise"));
    `);
    expect(consoleOrder(trace)).toEqual(["sync", "promise", "timer"]);
  });

  it("derives circuit values from Ohm's law", () => {
    expect(
      circuitValues({ kind: "circuit", voltage: 12, resistance: 6, capacitance: 0.01 }),
    ).toEqual({
      current: 2,
      power: 24,
      timeConstant: 0.06,
    });
  });
});
