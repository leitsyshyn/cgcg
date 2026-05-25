import { describe, expect, it } from 'vitest';
import { runLab } from '../src/app/runLab';
import type { AppPoint } from '../src/app/types';
import type { Point } from '../src/geometry/types';
import { TraceRecorder, filterTraceEvents } from '../src/trace/recorder';
import { projectTraceFrame } from '../src/trace/projector';
import type { TracePoint } from '../src/trace/events';

function p(id: string, x: number, y: number): TracePoint {
  return { id, label: id.toUpperCase(), sortedLabel: null, x, y };
}

function point(x: number, y: number): Point {
  return { x, y };
}

function appPoints(points: readonly Point[]): readonly AppPoint[] {
  return points.map((value, index) => ({
    id: `p${index + 1}`,
    name: `S${index + 1}`,
    x: value.x,
    y: value.y,
    sortedIndex: null,
  }));
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

  it('appends phase snapshot edges without discarding previous phase visuals', () => {
    const recorder = new TraceRecorder('phase');
    recorder.phase('input-normalized', 'normalized', { points: [p('a', 0, 0), p('b', 10, 0), p('c', 20, 0)] });
    recorder.phase('base-case', 'first base', { edges: [{ id: 'e1', from: 'a', to: 'b' }], edgeMode: 'append' });
    recorder.phase('base-case', 'second base', { edges: [{ id: 'e2', from: 'b', to: 'c' }], edgeMode: 'append' });

    const frame = projectTraceFrame(recorder.events, recorder.events.length - 1);
    expect(frame.visibleEdges.map((edge) => edge.id)).toEqual(['e1', 'e2']);
  });

  it('projects detailed geometry states used by the canvas', () => {
    const recorder = new TraceRecorder('detailed');
    recorder.phase('input-normalized', 'normalized', { points: [p('a', 0, 0), p('b', 10, 0), p('c', 0, 10)] });
    recorder.phase('recursive-split', 'split', { subsetIds: ['a', 'b', 'c'], splitX: 5, depth: 1 });
    recorder.detailed('edge-created', 'edge', { edge: { id: 'e1', from: 'a', to: 'b' }, edgeIds: ['e1'] });
    recorder.detailed('candidate-selection', 'candidates', {
      activeBaseEdge: ['a', 'b'],
      leftCandidate: ['a', 'c'],
      rightCandidate: ['b', 'c'],
    });
    recorder.detailed('in-circle-check', 'circle', {
      activeTriangle: { a: 'a', b: 'b', c: 'c' },
      testedPoint: 'c',
      circumcircle: { cx: 5, cy: 5, r: 7 },
    });
    const frame = projectTraceFrame(recorder.events, recorder.events.length - 1);
    expect(frame.splitLines).toEqual([{ id: 'split-1', x: 5, depth: 1 }]);
    expect(frame.activeTriangle).toEqual({ a: 'a', b: 'b', c: 'c' });
    expect(frame.testedPoint).toBe('c');
    expect(frame.circumcircle).toEqual({ cx: 5, cy: 5, r: 7 });

    recorder.detailed('edge-deleted', 'deleted', { edge: { id: 'e1', from: 'a', to: 'b' }, edgeIds: ['e1'] });
    const deletedFrame = projectTraceFrame(recorder.events, recorder.events.length - 1);
    expect(deletedFrame.visibleEdges).toEqual([]);
    expect(deletedFrame.deletedEdges).toEqual([{ id: 'e1', from: 'a', to: 'b' }]);
  });

  it('appends nearest-final arrows across projected steps', () => {
    const recorder = new TraceRecorder('detailed');
    recorder.phase('input-normalized', 'normalized', { points: [p('a', 0, 0), p('b', 10, 0), p('c', 20, 0)] });
    recorder.phase('nearest-final', 'a nearest', { nearestArrows: [{ from: 'a', to: 'b' }] });
    recorder.phase('nearest-final', 'b nearest', { nearestArrows: [{ from: 'b', to: 'c' }] });

    const frame = projectTraceFrame(recorder.events, 2);
    expect(frame.nearestArrows).toEqual([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]);
  });

  it('records detailed geometry and nearest-neighbor events from runLab only in detailed mode', () => {
    const input = appPoints([
      point(80, 80),
      point(220, 90),
      point(160, 210),
      point(360, 150),
      point(300, 300),
    ]);

    const detailed = runLab(input, 'detailed');
    expect(detailed.ok).toBe(true);
    if (!detailed.ok) return;

    const detailedPhases = new Set(detailed.value.trace.map((event) => event.phase));
    expect(detailedPhases).toContain('recursive-split');
    expect(detailedPhases).toContain('edge-created');
    expect(detailedPhases).toContain('candidate-selection');
    expect(detailedPhases).toContain('nearest-candidate-check');
    expect(detailed.value.trace.some((event) => event.level === 'detailed')).toBe(true);

    const phase = runLab(input, 'phase');
    expect(phase.ok).toBe(true);
    if (!phase.ok) return;
    expect(phase.value.trace.every((event) => event.level === 'phase')).toBe(true);
    expect(phase.value.trace.map((event) => event.phase)).toContain('recursive-split');
    expect(phase.value.trace.map((event) => event.phase)).toContain('merge-start');
    expect(phase.value.trace.map((event) => event.phase)).toContain('base-case');
    expect(phase.value.trace.map((event) => event.phase)).toContain('merge-complete');
    expect(phase.value.trace.map((event) => event.phase)).not.toContain('lower-tangent-found');
    expect(phase.value.trace.map((event) => event.phase)).not.toContain('base-edge-created');
    expect(phase.value.trace.map((event) => event.phase)).not.toContain('edge-created');
    expect(phase.value.trace.some((event) => event.phase === 'base-case' && event.edges && event.edges.length > 0)).toBe(true);
    expect(phase.value.trace.some((event) => event.phase === 'merge-complete' && event.edges && event.edges.length > 0)).toBe(true);
    expect(
      phase.value.trace
        .filter((event) => event.phase === 'base-case' || event.phase === 'merge-complete')
        .filter((event) => event.edges)
        .every((event) => event.edgeMode === 'append'),
    ).toBe(true);
  });
});
