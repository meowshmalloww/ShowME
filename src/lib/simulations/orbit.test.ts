import { describe, expect, it } from "vitest";
import { simulateOrbit } from "./orbit";

const earth = {
  gravitationalParameter: 3.986004418e14,
  planetRadius: 6_371_000,
  initialAltitude: 400_000,
};

describe("deterministic orbit module", () => {
  it("keeps a circular-orbit launch bounded with low energy drift", () => {
    const radius = earth.planetRadius + earth.initialAltitude;
    const circularVelocity = Math.sqrt(earth.gravitationalParameter / radius);
    const result = simulateOrbit({
      ...earth,
      initialVelocity: circularVelocity,
      duration: 5_600,
      steps: 2_800,
    });
    expect(result.outcome).toBe("bound-orbit");
    const radii = result.samples.map((sample) => sample.radius);
    expect((Math.max(...radii) - Math.min(...radii)) / radius).toBeLessThan(0.0001);
    const energies = result.samples.map((sample) => sample.specificEnergy);
    expect(
      (Math.max(...energies) - Math.min(...energies)) / Math.abs(energies[0] ?? 1),
    ).toBeLessThan(0.0001);
  });

  it("classifies low speed as impact and super-escape speed as escape", () => {
    const impact = simulateOrbit({
      ...earth,
      initialVelocity: 1_000,
      duration: 2_000,
      steps: 2_000,
    });
    const escapeTrajectory = simulateOrbit({
      ...earth,
      initialVelocity: 12_000,
      duration: 12_000,
      steps: 2_000,
    });
    expect(impact.outcome).toBe("impact");
    expect(escapeTrajectory.outcome).toBe("escape");
  });

  it("rejects non-physical parameters", () => {
    expect(() => simulateOrbit({ ...earth, initialVelocity: -1, duration: 1, steps: 2 })).toThrow(
      /physically valid/,
    );
  });
});
