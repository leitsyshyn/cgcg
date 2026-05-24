import type { AdjacencyGraph, NearestNeighbor, Point } from './types';
import { distanceSquared, sameDistance } from './predicates';

export function nearestNeighbors(points: readonly Point[], graph: AdjacencyGraph): readonly NearestNeighbor[] {
  const result: NearestNeighbor[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const source = points[index];
    if (!source) throw new Error(`Point ${index} does not exist.`);

    const adjacent = graph.get(index) ?? new Set<number>();
    let bestDistance = Number.POSITIVE_INFINITY;
    let neighbors: number[] = [];

    for (const neighbor of adjacent) {
      const target = points[neighbor];
      if (!target) continue;
      const candidateDistance = distanceSquared(source, target);

      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        neighbors = [neighbor];
      } else if (sameDistance(candidateDistance, bestDistance)) {
        neighbors.push(neighbor);
      }
    }

    result.push({
      point: index,
      neighbors: neighbors.sort((a, b) => a - b),
      distanceSquared: bestDistance,
    });
  }

  return result;
}
