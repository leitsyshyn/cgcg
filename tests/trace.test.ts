import { describe, expect, it } from 'vitest';
import { TraceRecorder, filterTraceEvents } from '../src/trace/recorder';
import { projectTraceFrame } from '../src/trace/projector';
import type { TracePoint } from '../src/trace/events';

function p(id: string, x: number, y: number): TracePoint {
  return { id, label: id.toUpperCase(), sortedLabel: null, x, y };
}

describe('trace recording and projection', () => {
  it('filters off, phase, and detailed trace levels', () => {
    const recorder = new TraceRecorder('detailed');
    recorder.phase('input-normalized', 'normalized');
    recorder.detailed('edge-created', 'edge', { edge: { id: 'e1', from: 'a', to: 'b' } });

    expect(filterTraceEvents(recorder.events, 'off')).toHaveLength(0);
    expect(filterTraceEvents(recorder.events, 'phase')).toHaveLength(1);
    expect(filterTraceEvents(recorder.events, 'detailed')).toHaveLength(2);
  });

  it('projects trace events into renderer frames without running algorithm logic', () => {
    const recorder = new TraceRecorder('detailed');
    recorder.phase('input-normalized', 'normalized', { points: [p('a', 0, 0), p('b', 10, 0)] });
    recorder.detailed('edge-created', 'edge', { edge: { id: 'e1', from: 'a', to: 'b' }, edgeIds: ['e1'] });
    recorder.phase('nearest-final', 'nearest', { nearestArrows: [{ from: 'a', to: 'b' }] });

    const frame = projectTraceFrame(recorder.events, 2);
    expect(frame.points).toHaveLength(2);
    expect(frame.visibleEdges.map((edge) => edge.id)).toEqual(['e1']);
    expect(frame.nearestArrows).toEqual([{ from: 'a', to: 'b' }]);
  });
});
