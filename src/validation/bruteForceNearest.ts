import type { NearestNeighbor, Point } from '../geometry/types';
import { distanceSquared, sameDistance } from '../geometry/predicates';
import type { ValidationResult } from './types';

export const BRUTE_FORCE_LIMIT = 100;

export function bruteForceNearestNeighbors(points: readonly Point[]): readonly NearestNeighbor[] {
  return points.map((point, index) => {
    let bestDistance = Number.POSITIVE_INFINITY;
    let neighbors: number[] = [];

    for (let candidateIndex = 0; candidateIndex < points.length; candidateIndex += 1) {
      if (candidateIndex === index) continue;
      const candidate = points[candidateIndex];
      if (!candidate) continue;
      const candidateDistance = distanceSquared(point, candidate);
      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        neighbors = [candidateIndex];
      } else if (sameDistance(candidateDistance, bestDistance)) {
        neighbors.push(candidateIndex);
      }
    }

    return { point: index, neighbors: neighbors.sort((a, b) => a - b), distanceSquared: bestDistance };
  });
}

export function validateNearestNeighbors(
  points: readonly Point[],
  delaunayResults: readonly NearestNeighbor[],
): ValidationResult {
  if (points.length > BRUTE_FORCE_LIMIT) {
    return { checked: false, ok: true, message: `Skipped brute-force validation for N > ${BRUTE_FORCE_LIMIT}.` };
  }

  const expected = bruteForceNearestNeighbors(points);
  const actualById = new Map(delaunayResults.map((result) => [result.point, result]));

  for (const expectedResult of expected) {
    const actual = actualById.get(expectedResult.point);
    if (!actual) {
      return { checked: true, ok: false, message: `Missing nearest-neighbor result for point ${expectedResult.point}.` };
    }
    if (actual.neighbors.join(',') !== expectedResult.neighbors.join(',')) {
      return {
        checked: true,
        ok: false,
        message: `Validation failed for point ${expectedResult.point}: expected ${expectedResult.neighbors.join(', ')}, got ${actual.neighbors.join(', ')}.`,
      };
    }
  }

  return { checked: true, ok: true, message: 'Validated against brute-force nearest neighbors.' };
}
