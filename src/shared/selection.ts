import type { Point, SelectionRegion } from "./types";

export function finalizeLasso(region: SelectionRegion, end: Point): SelectionRegion {
  const previous = region.points.at(-1) ?? end;
  const points =
    Math.hypot(previous.x - end.x, previous.y - end.y) >= 1
      ? [...region.points, end]
      : region.points;
  if (points.length >= 3 && polygonArea(points) >= 18) return { ...region, points };

  const start = points[0] ?? end;
  const finish = points.at(-1) ?? end;
  const dx = finish.x - start.x;
  const dy = finish.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 5) return { ...region, points };

  // A quick straight lasso gesture is still useful. Turn its stroke into a slim
  // closed ribbon instead of silently discarding it as a zero-area polygon.
  const padding = 7;
  const offsetX = (-dy / length) * padding;
  const offsetY = (dx / length) * padding;
  return {
    ...region,
    points: [
      normalizedPoint(start.x + offsetX, start.y + offsetY),
      normalizedPoint(finish.x + offsetX, finish.y + offsetY),
      normalizedPoint(finish.x - offsetX, finish.y - offsetY),
      normalizedPoint(start.x - offsetX, start.y - offsetY),
    ],
  };
}

function normalizedPoint(x: number, y: number): Point {
  return { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(1000, y)) };
}

function polygonArea(points: Point[]): number {
  return (
    Math.abs(
      points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length] ?? point;
        return sum + point.x * next.y - next.x * point.y;
      }, 0),
    ) / 2
  );
}
