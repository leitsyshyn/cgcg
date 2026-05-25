import type { NearestNeighbor, Point } from "./types";
import { distanceSquared, sameDistance } from "./predicates";
import { AdjacencyGraph } from "./adjacency-graph";
import type { GeometryTrace } from "./trace";

export function nearestNeighbors(
  points: readonly Point[],
  graph: AdjacencyGraph,
  trace?: GeometryTrace,
): readonly NearestNeighbor[] {
  const result: NearestNeighbor[] = [];

  trace?.phase("nearest-neighbor-start", "Started all nearest-neighbor search using only adjacent Delaunay vertices.", {
    pointIds: points.map((_, index) => trace.pointId(index)),
  });

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
      const activeDistance = {
        from: tracePointId(index, trace),
        to: tracePointId(neighbor, trace),
        distance2: candidateDistance,
      };

      trace?.detailed("nearest-candidate-check", "Checked a Delaunay-adjacent nearest-neighbor candidate.", {
        pointIds: [trace.pointId(index), trace.pointId(neighbor)],
        activeDistance,
      });

      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        neighbors = [neighbor];
        trace?.detailed("nearest-improved", "Found a closer adjacent candidate.", {
          pointIds: [trace.pointId(index), trace.pointId(neighbor)],
          activeDistance,
        });
      } else if (sameDistance(candidateDistance, bestDistance)) {
        neighbors.push(neighbor);
        trace?.detailed("nearest-tie", "Found an equal-distance nearest-neighbor tie.", {
          pointIds: [trace.pointId(index), trace.pointId(neighbor)],
          activeDistance,
        });
      }
    }

    neighbors = neighbors.sort((a, b) => a - b);
    result.push({
      point: index,
      neighbors,
      distanceSquared: bestDistance,
    });
    trace?.phase("nearest-final", `Final nearest neighbor(s) selected for ${trace.pointLabel(index)}.`, {
      pointIds: [trace.pointId(index), ...neighbors.map((neighbor) => trace.pointId(neighbor))],
      nearestArrows: neighbors.map((neighbor) => ({
        from: trace.pointId(index),
        to: trace.pointId(neighbor),
      })),
      ...(neighbors[0] !== undefined
        ? {
            activeDistance: {
              from: trace.pointId(index),
              to: trace.pointId(neighbors[0]),
              distance2: bestDistance,
            },
          }
        : {}),
    });
  }

  return result;
}

function tracePointId(index: number, trace: GeometryTrace | undefined): string {
  return trace?.pointId(index) ?? String(index);
}
