import type { TraceEdge } from './events';
import type { TraceEvent } from './events';
import type { CandidateFrame, SplitLineFrame, TraceFrame } from './frames';

export function projectTraceFrame(events: readonly TraceEvent[], eventIndex: number): TraceFrame {
  const clampedIndex = events.length === 0 ? -1 : Math.max(0, Math.min(eventIndex, events.length - 1));
  const edgeMap = new Map<string, TraceEdge>();
  const deletedMap = new Map<string, TraceEdge>();
  const splitLines: SplitLineFrame[] = [];

  let points = [] as TraceFrame['points'];
  let highlightedEdges: string[] = [];
  let activeSubset: string[] = [];
  let activeBaseEdge: TraceFrame['activeBaseEdge'] = null;
  let candidates: CandidateFrame[] = [];
  let activeTriangle: TraceFrame['activeTriangle'] = null;
  let testedPoint: TraceFrame['testedPoint'] = null;
  let circumcircle: TraceFrame['circumcircle'] = null;
  let nearestArrows: TraceFrame['nearestArrows'] = [];
  let activeDistance: TraceFrame['activeDistance'] = null;
  let explanation = 'Add points and run the algorithm.';
  let currentPhase: TraceFrame['currentPhase'] = 'idle';

  for (let i = 0; i <= clampedIndex; i += 1) {
    const event = events[i];
    if (!event) continue;
    currentPhase = event.phase;
    explanation = event.message;

    if (event.points) points = event.points;
    if (event.edge) edgeMap.set(event.edge.id, event.edge);
    if (event.edges) {
      edgeMap.clear();
      event.edges.forEach((edge) => edgeMap.set(edge.id, edge));
    }
    if (event.phase === 'edge-deleted' && event.edge) {
      edgeMap.delete(event.edge.id);
      deletedMap.set(event.edge.id, event.edge);
    }
    if (event.phase === 'recursive-split' && typeof event.splitX === 'number') {
      splitLines.push({ id: `split-${event.id}`, x: event.splitX, depth: event.depth ?? 0 });
    }

    highlightedEdges = event.edgeIds ? [...event.edgeIds] : [];
    activeSubset = event.subsetIds ? [...event.subsetIds] : activeSubset;
    activeBaseEdge = event.activeBaseEdge ?? null;
    activeTriangle = event.activeTriangle ?? null;
    testedPoint = event.testedPoint ?? null;
    circumcircle = event.circumcircle ?? null;
    activeDistance = event.activeDistance ?? null;

    const nextCandidates: CandidateFrame[] = [];
    if (event.leftCandidate) nextCandidates.push({ side: 'left', from: event.leftCandidate[0], to: event.leftCandidate[1] });
    if (event.rightCandidate) nextCandidates.push({ side: 'right', from: event.rightCandidate[0], to: event.rightCandidate[1] });
    candidates = nextCandidates;

    if (event.nearestArrows) {
      nearestArrows = event.phase === 'nearest-final' ? [...nearestArrows, ...event.nearestArrows] : event.nearestArrows;
    }
  }

  return {
    index: clampedIndex,
    points,
    visibleEdges: [...edgeMap.values()],
    highlightedEdges,
    deletedEdges: [...deletedMap.values()],
    activeSubset,
    splitLines,
    activeBaseEdge,
    candidates,
    activeTriangle,
    testedPoint,
    circumcircle,
    nearestArrows,
    activeDistance,
    currentPhase,
    explanation,
  };
}
