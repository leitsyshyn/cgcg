import type { AppPoint } from '../app/types';
import type { TraceEvent, TracePhase } from './events';

interface PointDescriptor {
  readonly id: string;
  readonly inputLabel: string;
  readonly sortedLabel: string | null;
}

export type PointLookup = ReadonlyMap<string, PointDescriptor>;

const PHASE_LABELS: Readonly<Record<TracePhase, string>> = {
  'input-rejected': 'Input rejected',
  'input-normalized': 'Input normalized',
  'points-sorted': 'Points sorted',
  'triangulation-start': 'Triangulation start',
  'recursive-split': 'Recursive split',
  'base-case': 'Base case',
  'edge-created': 'Edge created',
  'edge-spliced': 'Edge spliced',
  'edge-connected': 'Edge connected',
  'edge-deleted': 'Edge deleted',
  'orientation-check': 'Orientation check',
  'active-triangle': 'Active triangle',
  'merge-start': 'Merge start',
  'lower-tangent-search': 'Lower tangent search',
  'lower-tangent-found': 'Lower tangent found',
  'base-edge-created': 'Base edge created',
  'candidate-selection': 'Candidate selection',
  'in-circle-check': 'In-circle check',
  'merge-complete': 'Merge complete',
  'triangulation-complete': 'Triangulation complete',
  'adjacency-extracted': 'Adjacency extracted',
  'nearest-neighbor-start': 'Nearest search start',
  'nearest-candidate-check': 'Nearest candidate check',
  'nearest-improved': 'Nearest improved',
  'nearest-tie': 'Nearest tie',
  'nearest-final': 'Nearest final',
  'nearest-neighbor-complete': 'Nearest search complete',
  'validation-complete': 'Validation complete',
  'algorithm-complete': 'Algorithm complete',
};

export function createPointLookup(points: readonly AppPoint[]): PointLookup {
  return new Map(
    points.map((point) => [
      point.id,
      {
        id: point.id,
        inputLabel: point.name,
        sortedLabel: point.sortedIndex === null ? null : `P${point.sortedIndex + 1}`,
      },
    ]),
  );
}

export function phaseLabel(phase: TracePhase): string {
  return PHASE_LABELS[phase];
}

export function describeTraceEvent(event: TraceEvent, points: PointLookup): string {
  switch (event.phase) {
    case 'input-rejected':
      return event.details?.length
        ? `Rejected input: ${event.details.join(' ')}`
        : event.message;
    case 'input-normalized':
      return `Normalized ${event.points?.length ?? 0} point(s) and preserved stable app IDs.`;
    case 'points-sorted':
      return event.pointIds?.length
        ? `Sorted by x-coordinate: ${event.pointIds.map((id, index) => `P${index + 1}=${inputLabel(id, points)}`).join(', ')}.`
        : event.message;
    case 'triangulation-start':
      return `Started divide-and-conquer Delaunay triangulation for ${event.pointIds?.length ?? 0} point(s).`;
    case 'recursive-split':
      return `Depth ${event.depth ?? 0}: split ${joinPoints(event.subsetIds, points)} at x=${formatNumber(event.splitX)} into left ${joinPoints(event.leftIds, points)} and right ${joinPoints(event.rightIds, points)}.`;
    case 'base-case':
      return `${event.message} Subset: ${joinPoints(event.subsetIds, points)}.`;
    case 'edge-created':
      return `Created ${edgeId(event.edge?.id)} as ${edgePair(event.edge?.from, event.edge?.to, points)}.`;
    case 'edge-spliced':
      return event.edgeIds?.length
        ? `Spliced topology around ${event.edgeIds.map(edgeId).join(' and ')}.`
        : event.message;
    case 'edge-connected':
      return `Connected triangulation fronts with ${edgeId(event.edge?.id)} = ${edgePair(event.edge?.from, event.edge?.to, points)}.`;
    case 'edge-deleted':
      return `Deleted ${edgeId(event.edge?.id)} = ${edgePair(event.edge?.from, event.edge?.to, points)} after a failed empty-circle check.`;
    case 'orientation-check':
      return `Orientation of triangle ${triangleLabel(event, points)} is ${orientationLabel(event.value)} (sign ${formatNumber(event.value)}).`;
    case 'active-triangle':
      return `Active triangle is ${triangleLabel(event, points)}.`;
    case 'merge-start':
      return `Started merge for ${joinPoints(event.subsetIds, points)} across split x=${formatNumber(event.splitX)}.`;
    case 'lower-tangent-search':
      return `Testing whether ${activeBaseEdge(event, points)} is the lower common tangent.`;
    case 'lower-tangent-found':
      return `Lower common tangent fixed at ${activeBaseEdge(event, points)}.`;
    case 'base-edge-created':
      return `Inserted merge base edge ${activeBaseEdge(event, points)}.`;
    case 'candidate-selection':
      return `From base ${activeBaseEdge(event, points)}, left candidate = ${optionalPair(event.leftCandidate, points)}, right candidate = ${optionalPair(event.rightCandidate, points)}.`;
    case 'in-circle-check':
      return `Tested ${pointLabel(event.testedPoint, points)} against circumcircle(${triangleLabel(event, points)}): inside = ${truthLabel(event.value)}.`;
    case 'merge-complete':
      return `Completed merge for ${joinPoints(event.subsetIds, points)}.`;
    case 'triangulation-complete':
      return `Completed Delaunay triangulation with ${event.edges?.length ?? 0} edge(s).`;
    case 'adjacency-extracted':
      return `Extracted Delaunay adjacency graph with ${event.edges?.length ?? 0} undirected edge(s).`;
    case 'nearest-neighbor-start':
      return `Started nearest-neighbor scan over Delaunay adjacency.`;
    case 'nearest-candidate-check':
      return `Checked ${distanceLabel(event, points)}.`;
    case 'nearest-improved':
      return `Updated best neighbor using ${distanceLabel(event, points)}.`;
    case 'nearest-tie':
      return `Recorded tie using ${distanceLabel(event, points)}.`;
    case 'nearest-final':
      return `Final nearest neighbors for ${pointLabel(event.pointIds?.[0], points)}: ${joinPoints(event.pointIds?.slice(1), points)} with ${distanceLabel(event, points)}.`;
    case 'nearest-neighbor-complete':
      return `Completed all nearest-neighbor selections from the Delaunay graph.`;
    case 'validation-complete':
      return event.message;
    case 'algorithm-complete':
      return `Algorithm completed in ${formatNumber(event.runtimeMs)} ms.`;
    default:
      return event.message;
  }
}

function inputLabel(id: string | undefined, points: PointLookup): string {
  return points.get(id ?? '')?.inputLabel ?? id ?? 'unknown';
}

function pointLabel(id: string | undefined, points: PointLookup): string {
  const point = points.get(id ?? '');
  if (!point) return id ?? 'unknown';
  return point.sortedLabel ? `${point.inputLabel} [${point.sortedLabel}]` : point.inputLabel;
}

function joinPoints(ids: readonly string[] | undefined, points: PointLookup): string {
  if (!ids?.length) return 'none';
  return ids.map((id) => pointLabel(id, points)).join(', ');
}

function edgePair(fromId: string | undefined, toId: string | undefined, points: PointLookup): string {
  return `${pairPointLabel(fromId, points)}-${pairPointLabel(toId, points)}`;
}

function pairPointLabel(id: string | undefined, points: PointLookup): string {
  const point = points.get(id ?? '');
  if (!point) return id ?? 'unknown';
  return point.sortedLabel ?? point.inputLabel;
}

function edgeId(id: string | undefined): string {
  return id ? id.toUpperCase() : 'edge';
}

function triangleLabel(event: TraceEvent, points: PointLookup): string {
  if (!event.activeTriangle) return 'triangle';
  return [event.activeTriangle.a, event.activeTriangle.b, event.activeTriangle.c]
    .map((id) => pairPointLabel(id, points))
    .join(', ');
}

function orientationLabel(value: number | undefined): string {
  if ((value ?? 0) > 0) return 'counter-clockwise';
  if ((value ?? 0) < 0) return 'clockwise';
  return 'collinear';
}

function activeBaseEdge(event: TraceEvent, points: PointLookup): string {
  if (!event.activeBaseEdge) return 'base edge';
  return edgePair(event.activeBaseEdge[0], event.activeBaseEdge[1], points);
}

function optionalPair(pair: readonly [string, string] | null | undefined, points: PointLookup): string {
  if (!pair) return 'none';
  return edgePair(pair[0], pair[1], points);
}

function truthLabel(value: number | undefined): string {
  return value ? 'yes' : 'no';
}

function distanceLabel(event: TraceEvent, points: PointLookup): string {
  if (!event.activeDistance) return 'distance';
  return `d²(${pairPointLabel(event.activeDistance.from, points)}, ${pairPointLabel(event.activeDistance.to, points)}) = ${event.activeDistance.distance2.toFixed(2)}`;
}

function formatNumber(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(Math.abs(value) >= 100 ? 0 : 2) : '0';
}
