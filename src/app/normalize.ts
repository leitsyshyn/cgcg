import type { AppError, AppPoint, AppResult } from "./types";
import { sortedOrder } from "../geometry/order";

export function normalizePoints(
  points: readonly AppPoint[],
): AppResult<readonly AppPoint[]> {
  const errors: string[] = [];
  const seen = new Map<string, { point: AppPoint; index: number }>();

  points.forEach((item, index) => {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
      errors.push(
        `${item.name || `point ${index + 1}`} has non-finite coordinates.`,
      );
    }

    const key = `${item.x},${item.y}`;
    const previous = seen.get(key);
    if (previous) {
      errors.push(
        `Duplicate coordinates are unsupported: ${pointLabel(item, index)} duplicates ${pointLabel(previous.point, previous.index)} at (${item.x}, ${item.y}).`,
      );
    } else {
      seen.set(key, { point: item, index });
    }
  });

  if (points.length < 2) {
    errors.push("At least two distinct points are required.");
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

  const geometryPoints = points.map(({ x, y }) => ({ x, y }));
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

function pointLabel(point: AppPoint, index: number): string {
  return point.name || `point ${index + 1}`;
}
