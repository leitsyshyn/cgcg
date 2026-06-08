import { adjacencyGraph, type AdjacencyGraph } from './adjacency-graph';
import { delaunayTriangulation } from './delaunay-triangulation';
import { nearestNeighbors } from './nearest-neighbors';
import type { GeometryTrace } from './trace';
import type { NearestNeighbor, Point, Triangulation } from './types';

export interface GeometryCoreResult {
  readonly triangulation: Triangulation;
  readonly graph: AdjacencyGraph;
  readonly nearestNeighbors: readonly NearestNeighbor[];
}

export function runGeometryCore(
  points: readonly Point[],
  trace?: GeometryTrace,
): GeometryCoreResult {
  const triangulation = delaunayTriangulation(points, trace);
  const graph = adjacencyGraph(points.length, triangulation.edges);
  const nearest = nearestNeighbors(points, graph, trace);

  return {
    triangulation,
    graph,
    nearestNeighbors: nearest,
  };
}
