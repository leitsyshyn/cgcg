export type {
  EdgeId,
  PointId,
  TraceArrow,
  TraceCircle,
  TraceDistance,
  TraceEdge,
  TraceEventInput,
  TraceEventPayload,
  TraceLevelName,
  TracePhase,
  TracePoint,
  TraceTriangle,
} from "./types";

import type { TraceEventPayload, TraceLevelName, TracePhase } from "./types";

export interface TraceEvent extends TraceEventPayload {
  readonly id: number;
  readonly level: Exclude<TraceLevelName, 'off'>;
  readonly phase: TracePhase;
  readonly message: string;
}
