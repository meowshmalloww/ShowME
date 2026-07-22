"""Constrained deterministic verification worker for ShowME lesson modules."""

from __future__ import annotations

import json
import math
import sys
from typing import Any


def finite(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def verify(simulation: dict[str, Any]) -> dict[str, Any]:
    kind = simulation.get("kind")
    details: dict[str, str | float | int | bool] = {"module": str(kind)}
    valid = True

    if kind == "orbit":
        mu = finite(simulation.get("gravitationalParameter"), "gravitationalParameter")
        planet = finite(simulation.get("planetRadius"), "planetRadius")
        altitude = finite(simulation.get("initialAltitude"), "initialAltitude")
        velocity = finite(simulation.get("initialVelocity"), "initialVelocity")
        radius = planet + altitude
        if mu <= 0 or planet <= 0 or altitude <= 0 or radius <= planet:
            valid = False
        circular = math.sqrt(mu / radius) if valid else 0.0
        escape = math.sqrt(2 * mu / radius) if valid else 0.0
        details.update(
            radius=radius,
            circularVelocity=circular,
            escapeVelocity=escape,
            velocityRatio=velocity / circular if circular else 0.0,
        )
    elif kind == "projectile":
        gravity = finite(simulation.get("gravity"), "gravity")
        speed = finite(simulation.get("speed"), "speed")
        angle = math.radians(finite(simulation.get("angleDegrees"), "angleDegrees"))
        height = finite(simulation.get("initialHeight"), "initialHeight")
        drag = finite(simulation.get("dragCoefficient"), "dragCoefficient")
        valid = gravity > 0 and speed >= 0 and height >= 0 and drag >= 0
        vertical = speed * math.sin(angle)
        discriminant = vertical * vertical + 2 * gravity * height
        no_drag_time = (vertical + math.sqrt(max(0.0, discriminant))) / gravity if valid else 0.0
        duration = min(120.0, max(12.0, no_drag_time * 1.25))
        steps = max(240, math.ceil(duration * 80))
        dt = duration / steps
        x = 0.0
        y = height
        vx = speed * math.cos(angle)
        vy = vertical
        peak = height
        flight_time = 0.0
        for index in range(steps + 1):
            flight_time = index * dt
            peak = max(peak, y)
            if y < 0 and index > 0:
                break
            vy -= gravity * dt
            current_speed = math.hypot(vx, vy)
            damping = 1 / (1 + drag * current_speed * dt)
            vx *= damping
            vy *= damping
            x += vx * dt
            y += vy * dt
            if not all(math.isfinite(value) for value in (x, y, vx, vy)):
                valid = False
                break
        details.update(
            flightTime=flight_time,
            estimatedRange=x,
            peakHeight=peak,
            dragCoefficient=drag,
        )
    elif kind == "trigonometry":
        angle = math.radians(finite(simulation.get("angleDegrees"), "angleDegrees"))
        amplitude = finite(simulation.get("amplitude"), "amplitude")
        frequency = finite(simulation.get("frequency"), "frequency")
        phase = finite(simulation.get("phase"), "phase")
        function_name = simulation.get("function")
        functions = {"sin": math.sin, "cos": math.cos, "tan": math.tan}
        valid = function_name in functions and frequency > 0
        details.update(angleRadians=angle)
        if valid:
            details["value"] = amplitude * functions[str(function_name)](frequency * angle + phase)
    elif kind == "wave":
        frequency = finite(simulation.get("frequency"), "frequency")
        wavelength = finite(simulation.get("wavelength"), "wavelength")
        amplitude = finite(simulation.get("amplitude"), "amplitude")
        valid = frequency >= 0 and wavelength > 0 and amplitude >= 0
        details.update(waveSpeed=frequency * wavelength, period=1 / frequency if frequency > 0 else 0.0)
    elif kind == "circuit":
        voltage = finite(simulation.get("voltage"), "voltage")
        resistance = finite(simulation.get("resistance"), "resistance")
        capacitance = finite(simulation.get("capacitance"), "capacitance")
        valid = resistance > 0 and capacitance >= 0
        details.update(
            current=voltage / resistance if valid else 0.0,
            power=(voltage * voltage) / resistance if valid else 0.0,
            timeConstant=resistance * capacitance if valid else 0.0,
        )
    elif kind == "function-graph":
        x_min = finite(simulation.get("xMin"), "xMin")
        x_max = finite(simulation.get("xMax"), "xMax")
        for key in ("a", "b", "c"):
            finite(simulation.get(key), key)
        valid = x_max > x_min and simulation.get("expression") in {
            "linear", "quadratic", "exponential", "inverse"
        }
        details.update(domainWidth=x_max - x_min)
    elif kind == "event-loop":
        trace = simulation.get("trace")
        valid = isinstance(trace, list) and 0 < len(trace) <= 160
        details.update(traceSteps=len(trace) if isinstance(trace, list) else 0)
    elif kind == "motion-scene":
        duration = finite(simulation.get("durationSeconds"), "durationSeconds")
        beats = simulation.get("beats")
        layouts = {"timeline", "cause-effect", "sequence", "compare", "quote"}
        valid = (
            3 <= duration <= 30
            and simulation.get("layout") in layouts
            and isinstance(beats, list)
            and 2 <= len(beats) <= 6
            and all(
                isinstance(beat, dict)
                and all(isinstance(beat.get(field), str) and beat.get(field) for field in (
                    "id", "marker", "heading", "caption", "accent"
                ))
                for beat in beats
            )
        )
        details.update(durationSeconds=duration, beats=len(beats) if isinstance(beats, list) else 0)
    elif kind == "custom":
        entities = simulation.get("entities")
        motions = simulation.get("motions")
        if not isinstance(entities, list) or not isinstance(motions, list):
            valid = False
            entities, motions = [], []
        entity_ids = {item.get("id") for item in entities if isinstance(item, dict)}
        valid = valid and all(
            isinstance(motion, dict) and motion.get("entityId") in entity_ids for motion in motions
        )
        details.update(entities=len(entities), motions=len(motions))
    else:
        raise ValueError("Unsupported simulation module")

    return {
        "verified": bool(valid),
        "engine": "python",
        "summary": (
            "The deterministic parameters passed independent consistency checks."
            if valid
            else "The deterministic parameters failed an independent consistency check."
        ),
        "details": details,
    }


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read())
        if not isinstance(payload, dict) or payload.get("command") != "verify":
            raise ValueError("Unknown worker command")
        simulation = payload.get("simulation")
        if not isinstance(simulation, dict):
            raise ValueError("simulation must be an object")
        print(json.dumps({"ok": True, "result": verify(simulation)}, separators=(",", ":")))
    except Exception as error:  # The process boundary converts errors to a small JSON envelope.
        print(json.dumps({"ok": False, "error": str(error)[:500]}, separators=(",", ":")))


if __name__ == "__main__":
    main()
