import type { NearestNeighborResult, Point2D, ValidationResult } from '../geometry/types';
import { distance2, sameDistance } from '../geometry/predicates';

export const BRUTE_FORCE_LIMIT = 100;

export function bruteForceNearestNeighbors(points: readonly Point2D[]): readonly NearestNeighborResult[] {
  return points.map((point) => {
    let bestDistance = Number.POSITIVE_INFINITY;
    let neighborIds: string[] = [];

    for (const candidate of points) {
      if (candidate.id === point.id) continue;
      const candidateDistance = distance2(point, candidate);
      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        neighborIds = [candidate.id];
      } else if (sameDistance(candidateDistance, bestDistance)) {
        neighborIds.push(candidate.id);
      }
    }

    return { pointId: point.id, neighborIds: neighborIds.sort(), distance2: bestDistance };
  });
}

export function validateNearestNeighbors(
  points: readonly Point2D[],
  delaunayResults: readonly NearestNeighborResult[],
): ValidationResult {
  if (points.length > BRUTE_FORCE_LIMIT) {
    return { checked: false, ok: true, message: `Skipped brute-force validation for N > ${BRUTE_FORCE_LIMIT}.` };
  }

  const expected = bruteForceNearestNeighbors(points);
  const actualById = new Map(delaunayResults.map((result) => [result.pointId, result]));

  for (const expectedResult of expected) {
    const actual = actualById.get(expectedResult.pointId);
    if (!actual) {
      return { checked: true, ok: false, message: `Missing nearest-neighbor result for ${expectedResult.pointId}.` };
    }
    if (actual.neighborIds.join(',') !== expectedResult.neighborIds.join(',')) {
      return {
        checked: true,
        ok: false,
        message: `Validation failed for ${expectedResult.pointId}: expected ${expectedResult.neighborIds.join(', ')}, got ${actual.neighborIds.join(', ')}.`,
      };
    }
  }

  return { checked: true, ok: true, message: 'Validated against brute-force nearest neighbors.' };
}
