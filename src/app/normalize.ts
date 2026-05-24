import type { AppError, AppPoint, AppResult } from "./types";
import type { Point } from "../geometry/types";
import { collinear } from "../geometry/predicates";
import { sortedOrder } from "../geometry/delaunay-triangulation";

export function normalizePoints(
  points: readonly AppPoint[],
): AppResult<readonly AppPoint[]> {
  const errors: string[] = [];
  const seen = new Map<string, AppPoint>();

  points.forEach((item, index) => {
    if (!Number.isFinite(item.point.x) || !Number.isFinite(item.point.y)) {
      errors.push(
        `${item.name || `point ${index + 1}`} has non-finite coordinates.`,
      );
    }

    const key = `${item.point.x},${item.point.y}`;
    const duplicate = seen.get(key);
    if (duplicate) {
      errors.push(
        `${item.name} duplicates ${duplicate.name} at (${item.point.x}, ${item.point.y}).`,
      );
    } else {
      seen.set(key, item);
    }
  });

  if (points.length < 2) {
    errors.push("At least two distinct points are required.");
  }

  const geometryPoints = points.map((item) => item.point);
  if (geometryPoints.length > 2 && collinear(geometryPoints)) {
    errors.push(
      "All-collinear inputs with more than two points are rejected by this lab build.",
    );
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: {
        message: "Unsupported input.",
        details: errors,
      } satisfies AppError,
    };
  }

  const order = sortedOrder(geometryPoints);
  const sortedIndexByOriginal = new Map(
    order.map((originalIndex, sortedIndex) => [originalIndex, sortedIndex]),
  );

  return {
    ok: true,
    value: points.map((item, index) => ({
      ...item,
      sortedIndex: sortedIndexByOriginal.get(index) ?? null,
    })),
  };
}

export function geometryPoints(points: readonly AppPoint[]): readonly Point[] {
  return points.map((item) => item.point);
}
