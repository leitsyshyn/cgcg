import type { EdgeId, PointId, TraceArrow, TraceCircle, TraceDistance, TraceEdge, TracePhase, TracePoint, TraceTriangle } from './events';

export interface SplitLineFrame {
  readonly id: string;
  readonly x: number;
  readonly depth: number;
}

export interface CandidateFrame {
  readonly side: 'left' | 'right';
  readonly from: PointId;
  readonly to: PointId;
}

export interface TraceFrame {
  readonly index: number;
  readonly points: readonly TracePoint[];
  readonly visibleEdges: readonly TraceEdge[];
  readonly highlightedEdges: readonly EdgeId[];
  readonly deletedEdges: readonly TraceEdge[];
  readonly activeSubset: readonly PointId[];
  readonly splitLines: readonly SplitLineFrame[];
  readonly activeBaseEdge: readonly [PointId, PointId] | null;
  readonly candidates: readonly CandidateFrame[];
  readonly activeTriangle: TraceTriangle | null;
  readonly testedPoint: PointId | null;
  readonly circumcircle: TraceCircle | null;
  readonly nearestArrows: readonly TraceArrow[];
  readonly activeDistance: TraceDistance | null;
  readonly currentPhase: TracePhase | 'idle';
  readonly explanation: string;
}
