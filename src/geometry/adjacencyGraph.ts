import type { AdjacencyGraph, Edge } from './types';

export function adjacencyGraph(pointCount: number, edges: readonly Edge[]): AdjacencyGraph {
  const graph = new Map<number, Set<number>>();

  for (let index = 0; index < pointCount; index += 1) {
    graph.set(index, new Set<number>());
  }

  for (const edge of edges) {
    graph.get(edge.a)?.add(edge.b);
    graph.get(edge.b)?.add(edge.a);
  }

  return graph;
}
