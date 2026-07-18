import type { Point, SelectionRegion } from "./types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
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

export function regionBounds(region: SelectionRegion): Bounds {
  if (region.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = region.points.map((point) => point.x);
  const ys = region.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function combinedBounds(regions: SelectionRegion[], padding = 12): Bounds {
  const contentRegions = regions.filter((region) => region.kind !== "label");
  if (contentRegions.length === 0) {
    return { x: 0, y: 0, width: 1000, height: 1000 };
  }
  const bounds = contentRegions.map(regionBounds);
  const minX = Math.max(0, Math.min(...bounds.map((item) => item.x)) - padding);
  const minY = Math.max(0, Math.min(...bounds.map((item) => item.y)) - padding);
  const maxX = Math.min(1000, Math.max(...bounds.map((item) => item.x + item.width)) + padding);
  const maxY = Math.min(1000, Math.max(...bounds.map((item) => item.y + item.height)) + padding);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function boundsToPixels(bounds: Bounds, pixelWidth: number, pixelHeight: number): Bounds {
  return {
    x: Math.floor((bounds.x / 1000) * pixelWidth),
    y: Math.floor((bounds.y / 1000) * pixelHeight),
    width: Math.max(1, Math.ceil((bounds.width / 1000) * pixelWidth)),
    height: Math.max(1, Math.ceil((bounds.height / 1000) * pixelHeight)),
  };
}
