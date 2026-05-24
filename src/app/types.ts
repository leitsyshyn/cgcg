import type { Edge, NearestNeighbor, Point, Triangulation } from '../geometry/types';
import type { TraceEvent } from '../trace/events';

export interface AppPoint {
  readonly id: string;
  readonly name: string;
  readonly point: Point;
  readonly sortedIndex: number | null;
}

export interface AppEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
}

export interface ValidationResult {
  readonly checked: boolean;
  readonly ok: boolean;
  readonly message: string;
}

export interface AlgorithmResult {
  readonly points: readonly AppPoint[];
  readonly triangulation: Triangulation;
  readonly edges: readonly AppEdge[];
  readonly nearestNeighbors: readonly NearestNeighbor[];
  readonly validation: ValidationResult;
  readonly trace: readonly TraceEvent[];
  readonly runtimeMs: number;
}

export interface AppError {
  readonly message: string;
  readonly details?: readonly string[];
}

export type AppResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError };

export function appEdge(edge: Edge, points: readonly AppPoint[], index: number): AppEdge {
  const from = points[edge.a];
  const to = points[edge.b];
  if (!from || !to) throw new Error('Edge references a missing app point.');
  return { id: `e${index + 1}`, from: from.id, to: to.id };
}
