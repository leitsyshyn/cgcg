import type { TraceEventInput, TracePhase } from '../trace/types';

export interface GeometryTrace {
  readonly phaseSnapshots: boolean;
  readonly pointId: (index: number) => string;
  readonly pointLabel: (index: number) => string;
  readonly phase: (phase: TracePhase, message: string, payload?: TraceEventInput) => void;
  readonly detailed: (phase: TracePhase, message: string, payload?: TraceEventInput) => void;
}
