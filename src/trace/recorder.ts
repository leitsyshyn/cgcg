import type { TraceEvent, TraceEventInput, TraceLevelName, TracePhase } from './events';

export type TraceLevel = TraceLevelName;

export class TraceRecorder {
  private nextId = 0;
  private readonly recorded: TraceEvent[] = [];

  constructor(private readonly level: TraceLevel) {}

  get events(): readonly TraceEvent[] {
    return this.recorded;
  }

  phase(phase: TracePhase, message: string, payload: TraceEventInput = {}): void {
    this.record('phase', phase, message, payload);
  }

  detailed(phase: TracePhase, message: string, payload: TraceEventInput = {}): void {
    this.record('detailed', phase, message, payload);
  }

  private record(level: 'phase' | 'detailed', phase: TracePhase, message: string, payload: TraceEventInput): void {
    if (this.level === 'off') return;
    if (this.level === 'phase' && level === 'detailed') return;

    this.recorded.push({
      ...payload,
      id: this.nextId++,
      level,
      phase,
      message,
    });
  }
}

export function filterTraceEvents(events: readonly TraceEvent[], level: TraceLevel): readonly TraceEvent[] {
  if (level === 'off') return [];
  if (level === 'phase') return events.filter((event) => event.level === 'phase');
  return events;
}
