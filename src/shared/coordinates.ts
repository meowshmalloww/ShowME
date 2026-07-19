import type { Point, SelectionRegion } from "./types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowGeometry {
  angleDegrees: number;
  length: number;
  shaftEnd: Point;
  left: Point;
  right: Point;
}

export function clampCoordinate(value: number): number {
  return Math.min(1000, Math.max(0, value));
}

export function clientToNormalized(
  point: Point,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    throw new Error("Viewport dimensions must be positive");
  }
  return {
    x: clampCoordinate((point.x / viewportWidth) * 1000),
    y: clampCoordinate((point.y / viewportHeight) * 1000),
  };
}

export function normalizedToClient(
  point: Point,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  return {
    x: (clampCoordinate(point.x) / 1000) * viewportWidth,
    y: (clampCoordinate(point.y) / 1000) * viewportHeight,
  };
}

export function snapNormalizedPoint(
  start: Point,
  end: Point,
  viewportWidth: number,
  viewportHeight: number,
  incrementDegrees = 45,
): Point {
  if (viewportWidth <= 0 || viewportHeight <= 0 || incrementDegrees <= 0) return end;
  const startClient = normalizedToClient(start, viewportWidth, viewportHeight);
  const endClient = normalizedToClient(end, viewportWidth, viewportHeight);
  const dx = endClient.x - startClient.x;
  const dy = endClient.y - startClient.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return end;
  const increment = (incrementDegrees * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / increment) * increment;
  return clientToNormalized(
    {
      x: startClient.x + Math.cos(angle) * length,
      y: startClient.y + Math.sin(angle) * length,
    },
    viewportWidth,
    viewportHeight,
  );
}

export function arrowGeometry(
  start: Point,
  end: Point,
  strokeWidth = 3,
): ArrowGeometry | undefined {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 2) return undefined;
  const ux = dx / length;
  const uy = dy / length;
  const headLength = Math.min(22, Math.max(10, length * 0.22, strokeWidth * 4));
  const headWidth = Math.min(16, Math.max(7, headLength * 0.58, strokeWidth * 2.4));
  const base = { x: end.x - ux * headLength, y: end.y - uy * headLength };
  const nx = -uy;
  const ny = ux;
  return {
    angleDegrees: (Math.atan2(-dy, dx) * 180) / Math.PI,
    length,
    shaftEnd: {
      x: end.x - ux * Math.max(2, headLength * 0.72),
      y: end.y - uy * Math.max(2, headLength * 0.72),
    },
    left: { x: base.x + nx * headWidth, y: base.y + ny * headWidth },
    right: { x: base.x - nx * headWidth, y: base.y - ny * headWidth },
  };
}

export function regionBounds(region: SelectionRegion): Bounds {
  if (region.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = region.points.map((point) => point.x);
  const ys = region.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function combinedBounds(regions: SelectionRegion[], padding = 16): Bounds {
  const contentRegions = regions.filter((region) => region.kind !== "label");
  if (contentRegions.length === 0) return { x: 0, y: 0, width: 1000, height: 1000 };
  const bounds = contentRegions.map(regionBounds);
  const minX = Math.max(0, Math.min(...bounds.map((item) => item.x)) - padding);
  const minY = Math.max(0, Math.min(...bounds.map((item) => item.y)) - padding);
  const maxX = Math.min(1000, Math.max(...bounds.map((item) => item.x + item.width)) + padding);
  const maxY = Math.min(1000, Math.max(...bounds.map((item) => item.y + item.height)) + padding);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsToPixels(bounds: Bounds, pixelWidth: number, pixelHeight: number): Bounds {
  const x = Math.max(0, Math.floor((bounds.x / 1000) * pixelWidth));
  const y = Math.max(0, Math.floor((bounds.y / 1000) * pixelHeight));
  const width = Math.max(
    1,
    Math.min(pixelWidth - x, Math.ceil((bounds.width / 1000) * pixelWidth)),
  );
  const height = Math.max(
    1,
    Math.min(pixelHeight - y, Math.ceil((bounds.height / 1000) * pixelHeight)),
  );
  return { x, y, width, height };
}

export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}
