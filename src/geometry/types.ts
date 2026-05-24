export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Edge {
  readonly a: number;
  readonly b: number;
}

export interface Triangulation {
  readonly points: readonly Point[];
  readonly edges: readonly Edge[];
}

export type AdjacencyGraph = ReadonlyMap<number, ReadonlySet<number>>;

export interface NearestNeighbor {
  readonly point: number;
  readonly neighbors: readonly number[];
  readonly distanceSquared: number;
}

/** @internal Quad-edge topology record used by Delaunay construction. */
export interface QuadEdge {
  readonly edges: readonly [DirectedEdge, DirectedEdge, DirectedEdge, DirectedEdge];
}

/** @internal Directed record inside a quad-edge. */
export interface DirectedEdge {
  origin: number | null;
  next: DirectedEdge;
  quad: QuadEdge;
  index: 0 | 1 | 2 | 3;
  deleted: boolean;
}
