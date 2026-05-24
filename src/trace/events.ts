export type PointId = string;
export type EdgeId = string;

export type TraceLevelName = 'off' | 'phase' | 'detailed';

export type TracePhase =
  | 'input-rejected'
  | 'input-normalized'
  | 'points-sorted'
  | 'triangulation-start'
  | 'recursive-split'
  | 'base-case'
  | 'edge-created'
  | 'edge-spliced'
  | 'edge-connected'
  | 'edge-deleted'
  | 'orientation-check'
  | 'active-triangle'
  | 'merge-start'
  | 'lower-tangent-search'
  | 'lower-tangent-found'
  | 'base-edge-created'
  | 'candidate-selection'
  | 'in-circle-check'
  | 'merge-complete'
  | 'triangulation-complete'
  | 'adjacency-extracted'
  | 'nearest-neighbor-start'
  | 'nearest-candidate-check'
  | 'nearest-improved'
  | 'nearest-tie'
  | 'nearest-final'
  | 'nearest-neighbor-complete'
  | 'validation-complete'
  | 'algorithm-complete';

export interface TraceArrow {
  readonly from: PointId;
  readonly to: PointId;
}

export interface TraceDistance {
  readonly from: PointId;
  readonly to: PointId;
  readonly distance2: number;
}

export interface TraceCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface TracePoint {
  readonly id: PointId;
  readonly label: string;
  readonly sortedLabel: string | null;
  readonly x: number;
  readonly y: number;
}

export interface TraceEdge {
  readonly id: EdgeId;
  readonly from: PointId;
  readonly to: PointId;
}

export interface TraceEventPayload {
  readonly points?: readonly TracePoint[];
  readonly pointIds?: readonly PointId[];
  readonly subsetIds?: readonly PointId[];
  readonly leftIds?: readonly PointId[];
  readonly rightIds?: readonly PointId[];
  readonly edge?: TraceEdge;
  readonly edges?: readonly TraceEdge[];
  readonly edgeIds?: readonly EdgeId[];
  readonly splitX?: number;
  readonly depth?: number;
  readonly activeBaseEdge?: readonly [PointId, PointId];
  readonly activeTriangle?: readonly [PointId, PointId, PointId];
  readonly testedPoint?: PointId;
  readonly circumcircle?: TraceCircle | null;
  readonly leftCandidate?: readonly [PointId, PointId] | null;
  readonly rightCandidate?: readonly [PointId, PointId] | null;
  readonly nearestArrows?: readonly TraceArrow[];
  readonly activeDistance?: TraceDistance;
  readonly validation?: unknown;
  readonly value?: number;
  readonly details?: readonly string[];
  readonly runtimeMs?: number;
}

export interface TraceEvent extends TraceEventPayload {
  readonly id: number;
  readonly level: Exclude<TraceLevelName, 'off'>;
  readonly phase: TracePhase;
  readonly message: string;
}

export type TraceEventInput = Omit<TraceEvent, 'id' | 'level' | 'phase' | 'message'> & {
  readonly [key: string]: unknown;
};
