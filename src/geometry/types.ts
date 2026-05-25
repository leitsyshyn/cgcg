export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Edge {
  readonly a: number;
  readonly b: number;
}

export interface Circle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface Triangle<TVertex = number> {
  readonly a: TVertex;
  readonly b: TVertex;
  readonly c: TVertex;
}

export interface Triangulation {
  readonly points: readonly Point[];
  readonly edges: readonly Edge[];
}

export interface NearestNeighbor {
  readonly point: number;
  readonly neighbors: readonly number[];
  readonly distanceSquared: number;
}
