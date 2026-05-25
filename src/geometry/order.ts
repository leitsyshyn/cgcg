import type { Point } from "./types";

export function sortedOrder(points: readonly Point[]): readonly number[] {
  return points
    .map((_, index) => index)
    .sort((a, b) => pointOrder(points[a], points[b]));
}

export function pointOrder(a: Point | undefined, b: Point | undefined): number {
  if (!a || !b) return 0;
  return a.x - b.x || a.y - b.y;
}
