import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Bounds } from "../shared/coordinates";
import { boundsToPixels, combinedBounds } from "../shared/coordinates";
import { simulateProjectile } from "../shared/simulations/math";
import type { SelectionRegion, SimulationSpec, VerificationResult } from "../shared/types";

interface WorkerEnvelope<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

export class WorkerService {
  private readonly nativeExecutable: string;
  private readonly pythonExecutable: string;
  private readonly pythonScript: string;

  constructor(rootPath: string, resourcesPath: string, packaged: boolean) {
    const extension = process.platform === "win32" ? ".exe" : "";
    this.nativeExecutable = packaged
      ? join(resourcesPath, "workers", "showme-native" + extension)
      : join(rootPath, "workers", "native", "target", "release", "showme-native" + extension);
    this.pythonExecutable = packaged
      ? join(resourcesPath, "workers", "showme-verify" + extension)
      : join(rootPath, "workers", "python", "dist", "showme-verify" + extension);
    this.pythonScript = packaged
      ? join(resourcesPath, "workers", "verify.py")
      : join(rootPath, "workers", "python", "verify.py");
  }

  status(): { rust: boolean; python: boolean } {
    return {
      rust: existsSync(this.nativeExecutable),
      python: existsSync(this.pythonExecutable) || existsSync(this.pythonScript),
    };
  }

  async cropBounds(
    regions: SelectionRegion[],
    pixelWidth: number,
    pixelHeight: number,
  ): Promise<Bounds> {
    if (existsSync(this.nativeExecutable)) {
      try {
        const result = await runJsonWorker<{ bounds: Bounds }>(this.nativeExecutable, [], {
          command: "crop_bounds",
          width: pixelWidth,
          height: pixelHeight,
          padding: 16,
          regions,
        });
        return result.bounds;
      } catch {
        // The TypeScript implementation is intentionally equivalent and keeps capture usable.
      }
    }
    return boundsToPixels(combinedBounds(regions), pixelWidth, pixelHeight);
  }

  async verify(simulation: SimulationSpec | undefined): Promise<VerificationResult> {
    if (!simulation) {
      return {
        verified: false,
        engine: "none",
        summary: "This lesson is explanatory and does not use a numerical simulation.",
        details: {},
      };
    }
    try {
      const executable = existsSync(this.pythonExecutable) ? this.pythonExecutable : "python";
      const args = existsSync(this.pythonExecutable) ? [] : [this.pythonScript];
      const result = await runJsonWorker<VerificationResult>(executable, args, {
        command: "verify",
        simulation,
      });
      return result;
    } catch (error) {
      return verifyWithTypeScript(simulation, error);
    }
  }
}

function runJsonWorker<T>(command: string, args: string[], input: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Worker timed out"));
    }, 8_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 2_000_000) child.kill();
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || "Worker exited with code " + String(code)));
        return;
      }
      try {
        const envelope = JSON.parse(stdout.trim()) as WorkerEnvelope<T>;
        if (!envelope.ok || envelope.result === undefined) {
          reject(new Error(envelope.error || "Worker rejected the request"));
          return;
        }
        resolve(envelope.result);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

function verifyWithTypeScript(simulation: SimulationSpec, error: unknown): VerificationResult {
  const details: Record<string, number | string | boolean> = {};
  let valid = true;
  switch (simulation.kind) {
    case "orbit": {
      const radius = simulation.planetRadius + simulation.initialAltitude;
      const escapeVelocity = Math.sqrt((2 * simulation.gravitationalParameter) / radius);
      const circularVelocity = Math.sqrt(simulation.gravitationalParameter / radius);
      details.escapeVelocity = escapeVelocity;
      details.circularVelocity = circularVelocity;
      valid = Number.isFinite(escapeVelocity) && radius > simulation.planetRadius;
      break;
    }
    case "projectile": {
      const radians = (simulation.angleDegrees * Math.PI) / 180;
      const noDragFlightTime =
        (simulation.speed * Math.sin(radians) +
          Math.sqrt(
            (simulation.speed * Math.sin(radians)) ** 2 +
              2 * simulation.gravity * simulation.initialHeight,
          )) /
        simulation.gravity;
      const duration = Math.min(120, Math.max(12, noDragFlightTime * 1.25));
      const points = simulateProjectile(simulation, duration, Math.ceil(duration * 80));
      const last = points.at(-1);
      details.dragCoefficient = simulation.dragCoefficient;
      details.flightTime = last?.time ?? 0;
      details.estimatedRange = Math.max(...points.map((point) => point.x));
      details.peakHeight = Math.max(...points.map((point) => point.y));
      valid =
        simulation.dragCoefficient >= 0 &&
        points.length > 1 &&
        Object.values(details).every((value) =>
          typeof value === "number" ? Number.isFinite(value) : true,
        );
      break;
    }
    case "trigonometry":
      details.angleRadians = (simulation.angleDegrees * Math.PI) / 180;
      break;
    case "wave":
      details.waveSpeed = simulation.frequency * simulation.wavelength;
      valid = Number.isFinite(details.waveSpeed);
      break;
    case "circuit":
      details.current = simulation.voltage / simulation.resistance;
      details.timeConstant = simulation.resistance * simulation.capacitance;
      valid = Number.isFinite(details.current) && Number.isFinite(details.timeConstant);
      break;
    case "function-graph":
      valid = simulation.xMax > simulation.xMin;
      details.domainWidth = simulation.xMax - simulation.xMin;
      break;
    case "event-loop":
      details.traceSteps = simulation.trace.length;
      valid = simulation.trace.length > 0;
      break;
    case "motion-scene":
      details.beats = simulation.beats.length;
      details.durationSeconds = simulation.durationSeconds;
      valid = simulation.beats.length >= 2 && simulation.durationSeconds >= 3;
      break;
    case "custom":
      details.entities = simulation.entities.length;
      details.motions = simulation.motions.length;
      valid = simulation.motions.every((motion) =>
        simulation.entities.some((entity) => entity.id === motion.entityId),
      );
      break;
  }
  return {
    verified: valid,
    engine: "typescript",
    summary: valid
      ? "The deterministic parameters passed local consistency checks."
      : "The generated parameters failed a local consistency check.",
    details: {
      ...details,
      fallbackReason:
        error instanceof Error ? error.message.slice(0, 180) : "Python worker unavailable",
    },
  };
}
