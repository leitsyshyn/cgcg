# src/geometry/types.ts
```ts
export type PointId = string;
export type EdgeId = string;

export interface InputPoint {
  readonly id?: PointId;
  readonly x: number;
  readonly y: number;
}

export interface Point2D {
  readonly id: PointId;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface DelaunayEdge {
  readonly id: EdgeId;
  readonly from: PointId;
  readonly to: PointId;
}

export type AdjacencyGraph = Map<PointId, Set<PointId>>;

export interface NearestNeighborResult {
  readonly pointId: PointId;
  readonly neighborIds: readonly PointId[];
  readonly distance2: number;
}

export interface ValidationResult {
  readonly checked: boolean;
  readonly ok: boolean;
  readonly message: string;
}

export interface AlgorithmResult {
  readonly points: readonly Point2D[];
  readonly delaunayEdges: readonly DelaunayEdge[];
  readonly adjacency: AdjacencyGraph;
  readonly nearestNeighbors: readonly NearestNeighborResult[];
  readonly validation: ValidationResult;
  readonly trace: readonly import('../trace/events').TraceEvent[];
  readonly runtimeMs: number;
}

export interface GeometryError {
  readonly message: string;
  readonly details?: readonly string[];
}

export type GeometryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GeometryError };
```

# src/App.tsx
```tsx
import { useEffect, useState } from 'react';
import { GeometryCanvas } from './components/GeometryCanvas';
import type { AlgorithmResult, InputPoint, Point2D } from './geometry/types';
import { runNearestNeighborLab } from './geometry/runAlgorithm';
import { filterTraceEvents, type TraceLevel } from './trace/recorder';
import { projectTraceFrame } from './trace/projector';
import type { TraceFrame } from './trace/frames';
import { defaultToggles, type VisualizationMode, type VisualizationToggles } from './app/visualization';

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 560;

function pointFromInput(point: InputPoint, index: number): Point2D {
  const id = point.id ?? `p${index + 1}`;
  return { id, label: id.toUpperCase(), x: point.x, y: point.y };
}

function idleFrame(points: readonly InputPoint[]): TraceFrame {
  return {
    index: -1,
    points: points.map(pointFromInput),
    visibleEdges: [],
    highlightedEdges: [],
    deletedEdges: [],
    activeSubset: [],
    splitLines: [],
    activeBaseEdge: null,
    candidates: [],
    activeTriangle: null,
    testedPoint: null,
    circumcircle: null,
    nearestArrows: [],
    activeDistance: null,
    currentPhase: 'idle',
    explanation: 'Click the working area to add points, then run the algorithm.',
  };
}

export default function App() {
  const [points, setPoints] = useState<InputPoint[]>([]);
  const [mode, setMode] = useState<VisualizationMode>('step');
  const [toggles, setToggles] = useState<VisualizationToggles>(defaultToggles);
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(450);

  const effectiveMode: VisualizationMode = points.length > 100 && mode === 'step' ? 'result' : mode;
  const traceLevel: TraceLevel = effectiveMode === 'step' ? 'detailed' : 'phase';
  const events = result ? filterTraceEvents(result.trace, effectiveMode === 'step' ? 'detailed' : 'phase') : [];
  const maxStep = Math.max(0, events.length - 1);
  const frame = result ? projectTraceFrame(events, effectiveMode === 'result' ? maxStep : step) : idleFrame(points);

  useEffect(() => {
    if (!playing || effectiveMode === 'result') return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= maxStep) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [effectiveMode, maxStep, playing, speedMs]);

  function addPoint(x: number, y: number): void {
    const id = `p${points.length + 1}`;
    setPoints((current) => [...current, { id, x: Math.round(x), y: Math.round(y) }]);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function generateRandom(): void {
    const count = 18;
    const generated = Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`,
      x: 45 + Math.round(Math.random() * (CANVAS_WIDTH - 90)),
      y: 45 + Math.round(Math.random() * (CANVAS_HEIGHT - 90)),
    }));
    setPoints(generated);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function generateGrid(): void {
    const generated: InputPoint[] = [];
    let index = 1;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        generated.push({ id: `p${index++}`, x: 150 + column * 110 + (row % 2) * 16, y: 110 + row * 85 });
      }
    }
    setPoints(generated);
    setResult(null);
    setError(null);
    setStep(0);
  }

  function clear(): void {
    setPoints([]);
    setResult(null);
    setError(null);
    setStep(0);
    setPlaying(false);
  }

  function run(): void {
    setPlaying(false);
    const nextMode = points.length > 100 ? 'result' : effectiveMode;
    if (nextMode !== mode) setMode(nextMode);
    const computed = runNearestNeighborLab(points, points.length > 100 ? 'phase' : traceLevel);
    if (!computed.ok) {
      setError([computed.error.message, ...(computed.error.details ?? [])].join(' '));
      setResult(null);
      return;
    }
    setError(null);
    setResult(computed.value);
    const projectedEvents = filterTraceEvents(computed.value.trace, nextMode === 'step' ? 'detailed' : 'phase');
    setStep(nextMode === 'result' ? Math.max(0, projectedEvents.length - 1) : 0);
  }

  function updateToggle(key: keyof VisualizationToggles): void {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  const modeLabel = effectiveMode === 'step' ? 'Step mode' : effectiveMode === 'phase' ? 'Phase mode' : 'Result-only mode';

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Computational geometry laboratory</p>
          <h1>All nearest neighbors through Delaunay triangulation</h1>
          <p>
            Manual divide-and-conquer Delaunay construction, adjacency extraction, nearest-neighbor ties, trace projection, and D3/SVG visualization.
          </p>
        </div>
        <div className="metric-card">
          <span>Complexity target</span>
          <strong>O(N log N)</strong>
          <small>Sort, recursively split, merge triangulations, then scan Delaunay adjacency.</small>
        </div>
      </section>

      <section className="workspace">
        <div className="canvas-panel">
          <GeometryCanvas frame={frame} toggles={toggles} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} onAddPoint={addPoint} />
          <div className="step-explanation">{frame.explanation}</div>
        </div>

        <aside className="control-panel">
          <div className="control-group">
            <h2>Input</h2>
            <button type="button" onClick={generateRandom}>Random small set</button>
            <button type="button" onClick={generateGrid}>Structured grid</button>
            <button type="button" onClick={clear}>Clear/reset</button>
            <button type="button" className="primary" onClick={run} disabled={points.length < 2}>Run algorithm</button>
          </div>

          <div className="control-group">
            <h2>Visualization Mode</h2>
            <select value={mode} onChange={(event) => setMode(event.target.value as VisualizationMode)}>
              <option value="step" disabled={points.length > 100}>Step mode</option>
              <option value="phase">Phase mode</option>
              <option value="result">Result-only mode</option>
            </select>
            {points.length > 100 ? <p className="note">Detailed tracing is disabled for N &gt; 100.</p> : null}
          </div>

          <div className="control-group">
            <h2>Playback</h2>
            <div className="button-row">
              <button type="button" onClick={() => setStep(0)} disabled={!result}>Reset trace</button>
              <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={!result || effectiveMode === 'result'}>Prev</button>
              <button type="button" onClick={() => setStep((value) => Math.min(maxStep, value + 1))} disabled={!result || effectiveMode === 'result'}>Next</button>
              <button type="button" onClick={() => setPlaying((value) => !value)} disabled={!result || effectiveMode === 'result'}>{playing ? 'Pause' : 'Play'}</button>
            </div>
            <label className="range-label">
              Speed
              <input type="range" min="100" max="1600" step="50" value={speedMs} onChange={(event) => setSpeedMs(Number(event.target.value))} />
            </label>
            <label className="range-label">
              Step
              <input type="range" min="0" max={maxStep} value={Math.min(step, maxStep)} onChange={(event) => setStep(Number(event.target.value))} disabled={!result || effectiveMode === 'result'} />
            </label>
          </div>

          <div className="control-group toggles">
            <h2>Layers</h2>
            {(Object.keys(toggles) as Array<keyof VisualizationToggles>).map((key) => (
              <label key={key}>
                <input type="checkbox" checked={toggles[key]} onChange={() => updateToggle(key)} />
                {key}
              </label>
            ))}
          </div>

          <div className="control-group status-panel">
            <h2>Status</h2>
            <dl>
              <dt>Points</dt><dd>{points.length}</dd>
              <dt>Delaunay edges</dt><dd>{result?.delaunayEdges.length ?? 0}</dd>
              <dt>Mode</dt><dd>{modeLabel}</dd>
              <dt>Step</dt><dd>{result ? `${effectiveMode === 'result' ? maxStep : step} / ${maxStep}` : 'not run'}</dd>
              <dt>Phase</dt><dd>{frame.currentPhase}</dd>
              <dt>Validation</dt><dd className={result?.validation.ok === false ? 'bad' : 'good'}>{result?.validation.message ?? 'not checked'}</dd>
              <dt>Runtime</dt><dd>{result ? `${result.runtimeMs.toFixed(2)} ms` : 'not run'}</dd>
            </dl>
            {error ? <p className="error-box">{error}</p> : null}
          </div>
        </aside>
      </section>

      {result ? (
        <section className="results-panel">
          <h2>Nearest-Neighbor Relation</h2>
          <div className="result-grid">
            {result.nearestNeighbors.map((item) => (
              <div key={item.pointId} className="result-pill">
                <strong>{item.pointId.toUpperCase()}</strong>
                <span>→ {item.neighborIds.map((id) => id.toUpperCase()).join(', ')}</span>
                <small>d² = {item.distance2.toFixed(2)}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
```

# src/components/GeometryCanvas.tsx
```tsx
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { Point2D, PointId } from '../geometry/types';
import type { TraceFrame } from '../trace/frames';
import type { VisualizationToggles } from '../app/visualization';

interface GeometryCanvasProps {
  readonly frame: TraceFrame;
  readonly toggles: VisualizationToggles;
  readonly width: number;
  readonly height: number;
  readonly onAddPoint: (x: number, y: number) => void;
}

interface RenderLine {
  readonly id: string;
  readonly from: Point2D;
  readonly to: Point2D;
  readonly className: string;
}

export function GeometryCanvas({ frame, toggles, width, height, onAddPoint }: GeometryCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const svg = d3.select(svgElement);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrow-head')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('class', 'arrow-head');

    svg.append('rect').attr('class', 'canvas-bg').attr('width', width).attr('height', height);

    const pointById = new Map<PointId, Point2D>(frame.points.map((point) => [point.id, point]));
    const activeSubset = new Set(frame.activeSubset);
    const highlightedEdges = new Set(frame.highlightedEdges);

    if (toggles.splitLines) {
      svg
        .append('g')
        .attr('class', 'split-lines')
        .selectAll<SVGLineElement, (typeof frame.splitLines)[number]>('line')
        .data(frame.splitLines, (line) => line.id)
        .join('line')
        .attr('class', 'split-line')
        .attr('x1', (line) => line.x)
        .attr('x2', (line) => line.x)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke-dasharray', (line) => `${4 + line.depth} 6`);
    }

    const normalEdges: RenderLine[] = toggles.delaunayEdges
      ? frame.visibleEdges.flatMap((edge) => {
          const from = pointById.get(edge.from);
          const to = pointById.get(edge.to);
          if (!from || !to) return [];
          return [{ id: edge.id, from, to, className: highlightedEdges.has(edge.id) ? 'edge active' : 'edge normal' }];
        })
      : [];

    const deletedEdges: RenderLine[] = toggles.deletedEdges
      ? frame.deletedEdges.flatMap((edge) => {
          const from = pointById.get(edge.from);
          const to = pointById.get(edge.to);
          if (!from || !to) return [];
          return [{ id: `deleted-${edge.id}`, from, to, className: 'edge deleted' }];
        })
      : [];

    const candidateEdges: RenderLine[] = toggles.candidateEdges
      ? frame.candidates.flatMap((candidate) => {
          const from = pointById.get(candidate.from);
          const to = pointById.get(candidate.to);
          if (!from || !to) return [];
          return [{ id: `candidate-${candidate.side}-${candidate.from}-${candidate.to}`, from, to, className: `edge candidate ${candidate.side}` }];
        })
      : [];

    const baseEdge: RenderLine[] = frame.activeBaseEdge
      ? (() => {
          const from = pointById.get(frame.activeBaseEdge[0]);
          const to = pointById.get(frame.activeBaseEdge[1]);
          return from && to ? [{ id: 'active-base-edge', from, to, className: 'edge base active' }] : [];
        })()
      : [];

    const nearestEdges: RenderLine[] = toggles.nearestArrows
      ? frame.nearestArrows.flatMap((arrow, index) => {
          const from = pointById.get(arrow.from);
          const to = pointById.get(arrow.to);
          if (!from || !to) return [];
          return [{ id: `nearest-${index}-${arrow.from}-${arrow.to}`, from, to, className: 'edge nearest' }];
        })
      : [];

    const activeDistance: RenderLine[] = frame.activeDistance
      ? (() => {
          const from = pointById.get(frame.activeDistance.from);
          const to = pointById.get(frame.activeDistance.to);
          return from && to ? [{ id: 'active-distance', from, to, className: 'edge checked' }] : [];
        })()
      : [];

    const lines = [...normalEdges, ...deletedEdges, ...candidateEdges, ...baseEdge, ...nearestEdges, ...activeDistance];
    svg
      .append('g')
      .attr('class', 'edges')
      .selectAll<SVGLineElement, RenderLine>('line')
      .data<RenderLine>(lines, (line) => line.id)
      .join('line')
      .attr('class', (line) => line.className)
      .attr('x1', (line) => line.from.x)
      .attr('y1', (line) => line.from.y)
      .attr('x2', (line) => line.to.x)
      .attr('y2', (line) => line.to.y)
      .attr('marker-end', (line) => (line.className.includes('nearest') ? 'url(#arrow-head)' : null));

    if (frame.activeTriangle) {
      const trianglePoints = frame.activeTriangle.map((id) => pointById.get(id)).filter((point): point is Point2D => Boolean(point));
      if (trianglePoints.length === 3) {
        svg
          .append('polygon')
          .attr('class', 'active-triangle')
          .attr('points', trianglePoints.map((point) => `${point.x},${point.y}`).join(' '));
      }
    }

    if (toggles.circumcircles && frame.circumcircle) {
      svg
        .append('circle')
        .attr('class', 'circumcircle')
        .attr('cx', frame.circumcircle.cx)
        .attr('cy', frame.circumcircle.cy)
        .attr('r', frame.circumcircle.r);
    }

    svg
      .append('g')
      .attr('class', 'points')
      .selectAll<SVGCircleElement, Point2D>('circle')
      .data<Point2D>(frame.points, (point) => point.id)
      .join('circle')
      .attr('class', (point) => {
        const classes = ['point', 'normal'];
        if (activeSubset.has(point.id)) classes.push('active');
        if (frame.testedPoint === point.id) classes.push('checked');
        return classes.join(' ');
      })
      .attr('cx', (point) => point.x)
      .attr('cy', (point) => point.y)
      .attr('r', (point) => (activeSubset.has(point.id) ? 5.5 : 4.5));

    if (toggles.labels) {
      svg
        .append('g')
        .attr('class', 'labels')
        .selectAll<SVGTextElement, Point2D>('text')
        .data<Point2D>(frame.points, (point) => point.id)
        .join('text')
        .attr('class', 'point-label')
        .attr('x', (point) => point.x + 8)
        .attr('y', (point) => point.y - 8)
        .text((point) => point.label);
    }
  }, [frame, toggles, width, height]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const handleClick = (event: MouseEvent) => {
      const rect = svgElement.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      onAddPoint((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
    };
    svgElement.addEventListener('click', handleClick);
    return () => svgElement.removeEventListener('click', handleClick);
  }, [height, onAddPoint, width]);

  return <svg ref={svgRef} className="geometry-canvas" role="img" aria-label="Delaunay nearest-neighbor trace" />;
}
```

# src/geometry/delaunayDivideConquer.ts
```ts
import type { DelaunayEdge, GeometryResult, Point2D } from './types';
import { inCircle, orientation, EPSILON, circumcircle } from './predicates';
import { type DirectedEdge, QuadEdgeSubdivision } from './quadEdge';
import type { TraceRecorder } from '../trace/recorder';

interface HullEdges {
  readonly ldo: DirectedEdge;
  readonly rdo: DirectedEdge;
}

export interface DelaunayTriangulation {
  readonly edges: readonly DelaunayEdge[];
}

export function buildDelaunayDivideAndConquer(
  sortedPoints: readonly Point2D[],
  trace?: TraceRecorder,
): GeometryResult<DelaunayTriangulation> {
  if (sortedPoints.length < 2) {
    return { ok: false, error: { message: 'At least two points are required for Delaunay construction.' } };
  }

  try {
    const subdivision = new QuadEdgeSubdivision(trace);
    trace?.phase('triangulation-start', 'Started divide-and-conquer Delaunay triangulation.', {
      pointIds: sortedPoints.map((point) => point.id),
    });
    divide(sortedPoints, 0, sortedPoints.length, subdivision, trace, 0);
    const edges = subdivision.extractEdges();
    trace?.phase('triangulation-complete', 'Completed Delaunay triangulation. The graph is dual to the Voronoi diagram.', {
      edges,
      edgeIds: edges.map((edge) => edge.id),
    });
    return { ok: true, value: { edges } };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: 'Delaunay construction failed on this input.',
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

function divide(
  points: readonly Point2D[],
  start: number,
  end: number,
  subdivision: QuadEdgeSubdivision,
  trace: TraceRecorder | undefined,
  depth: number,
): HullEdges {
  const count = end - start;
  const subset = points.slice(start, end);

  if (count === 2) {
    const aPoint = mustPoint(points[start]);
    const bPoint = mustPoint(points[start + 1]);
    trace?.phase('base-case', `Base case with two points: ${aPoint.label}, ${bPoint.label}.`, {
      pointIds: [aPoint.id, bPoint.id],
      subsetIds: [aPoint.id, bPoint.id],
    });
    const edge = subdivision.makeEdge(aPoint, bPoint);
    return { ldo: edge, rdo: subdivision.sym(edge) };
  }

  if (count === 3) {
    const aPoint = mustPoint(points[start]);
    const bPoint = mustPoint(points[start + 1]);
    const cPoint = mustPoint(points[start + 2]);
    trace?.phase('base-case', `Base case with three points: ${aPoint.label}, ${bPoint.label}, ${cPoint.label}.`, {
      pointIds: [aPoint.id, bPoint.id, cPoint.id],
      subsetIds: [aPoint.id, bPoint.id, cPoint.id],
    });
    const a = subdivision.makeEdge(aPoint, bPoint);
    const b = subdivision.makeEdge(bPoint, cPoint);
    subdivision.splice(subdivision.sym(a), b);
    const orient = orientation(aPoint, bPoint, cPoint);
    trace?.detailed('orientation-check', 'Checked orientation for three-point base case.', {
      pointIds: [aPoint.id, bPoint.id, cPoint.id],
      value: orient,
      activeTriangle: [aPoint.id, bPoint.id, cPoint.id],
    });

    if (orient > EPSILON) {
      const c = subdivision.connect(b, a);
      trace?.detailed('active-triangle', 'Created counter-clockwise base triangle.', {
        activeTriangle: [aPoint.id, bPoint.id, cPoint.id],
        edgeIds: [a.baseId, b.baseId, c.baseId],
      });
      return { ldo: a, rdo: subdivision.sym(b) };
    }

    if (orient < -EPSILON) {
      const c = subdivision.connect(b, a);
      trace?.detailed('active-triangle', 'Created clockwise base triangle and returned hull edges accordingly.', {
        activeTriangle: [aPoint.id, cPoint.id, bPoint.id],
        edgeIds: [a.baseId, b.baseId, c.baseId],
      });
      return { ldo: subdivision.sym(c), rdo: c };
    }

    return { ldo: a, rdo: subdivision.sym(b) };
  }

  const middle = start + Math.floor(count / 2);
  const leftSubset = points.slice(start, middle);
  const rightSubset = points.slice(middle, end);
  const splitX = (mustPoint(points[middle - 1]).x + mustPoint(points[middle]).x) / 2;
  trace?.phase('recursive-split', 'Split point set by median x-coordinate.', {
    pointIds: subset.map((point) => point.id),
    subsetIds: subset.map((point) => point.id),
    leftIds: leftSubset.map((point) => point.id),
    rightIds: rightSubset.map((point) => point.id),
    splitX,
    depth,
  });

  const left = divide(points, start, middle, subdivision, trace, depth + 1);
  const right = divide(points, middle, end, subdivision, trace, depth + 1);
  return merge(left, right, subdivision, trace, subset, splitX);
}

function merge(
  left: HullEdges,
  right: HullEdges,
  subdivision: QuadEdgeSubdivision,
  trace: TraceRecorder | undefined,
  subset: readonly Point2D[],
  splitX: number,
): HullEdges {
  let ldi = left.rdo;
  let rdi = right.ldo;

  trace?.phase('merge-start', 'Started merge: find lower common tangent, then stitch the two Delaunay triangulations.', {
    subsetIds: subset.map((point) => point.id),
    splitX,
    edgeIds: [ldi.baseId, rdi.baseId],
  });

  while (true) {
    trace?.detailed('lower-tangent-search', 'Testing current lower tangent candidates.', {
      edgeIds: [ldi.baseId, rdi.baseId],
      activeBaseEdge: [subdivision.orig(ldi).id, subdivision.orig(rdi).id],
    });

    if (leftOf(subdivision.orig(rdi), ldi, subdivision)) {
      ldi = subdivision.lnext(ldi);
      continue;
    }

    if (rightOf(subdivision.orig(ldi), rdi, subdivision)) {
      rdi = subdivision.rprev(rdi);
      continue;
    }

    break;
  }

  trace?.phase('lower-tangent-found', 'Found the lower common tangent.', {
    activeBaseEdge: [subdivision.orig(ldi).id, subdivision.orig(rdi).id],
    edgeIds: [ldi.baseId, rdi.baseId],
  });

  let base = subdivision.connect(subdivision.sym(rdi), ldi);
  trace?.phase('base-edge-created', 'Inserted the initial base edge across the split.', {
    edgeIds: [base.baseId],
    activeBaseEdge: [subdivision.orig(base).id, subdivision.dest(base).id],
  });

  let ldo = left.ldo;
  let rdo = right.rdo;

  if (samePoint(subdivision.orig(ldi), subdivision.orig(ldo))) {
    ldo = subdivision.sym(base);
  }
  if (samePoint(subdivision.orig(rdi), subdivision.orig(rdo))) {
    rdo = base;
  }

  while (true) {
    let leftCandidate = subdivision.onext(subdivision.sym(base));
    if (valid(leftCandidate, base, subdivision)) {
      while (true) {
        const next = subdivision.onext(leftCandidate);
        const check = inCircle(
          subdivision.dest(base),
          subdivision.orig(base),
          subdivision.dest(leftCandidate),
          subdivision.dest(next),
        );
        trace?.detailed('in-circle-check', 'Checked whether the next left candidate violates the Delaunay empty-circle condition.', {
          edgeIds: [base.baseId, leftCandidate.baseId, next.baseId],
          pointIds: [
            subdivision.dest(base).id,
            subdivision.orig(base).id,
            subdivision.dest(leftCandidate).id,
            subdivision.dest(next).id,
          ],
          activeTriangle: [subdivision.dest(base).id, subdivision.orig(base).id, subdivision.dest(leftCandidate).id],
          testedPoint: subdivision.dest(next).id,
          circumcircle: circumcircle(subdivision.dest(base), subdivision.orig(base), subdivision.dest(leftCandidate)),
          value: check,
        });
        if (check <= EPSILON) break;
        const toDelete = leftCandidate;
        leftCandidate = next;
        subdivision.deleteEdge(toDelete);
      }
    }

    let rightCandidate = subdivision.oprev(base);
    if (valid(rightCandidate, base, subdivision)) {
      while (true) {
        const previous = subdivision.oprev(rightCandidate);
        const check = inCircle(
          subdivision.dest(base),
          subdivision.orig(base),
          subdivision.dest(rightCandidate),
          subdivision.dest(previous),
        );
        trace?.detailed('in-circle-check', 'Checked whether the next right candidate violates the Delaunay empty-circle condition.', {
          edgeIds: [base.baseId, rightCandidate.baseId, previous.baseId],
          pointIds: [
            subdivision.dest(base).id,
            subdivision.orig(base).id,
            subdivision.dest(rightCandidate).id,
            subdivision.dest(previous).id,
          ],
          activeTriangle: [subdivision.dest(base).id, subdivision.orig(base).id, subdivision.dest(rightCandidate).id],
          testedPoint: subdivision.dest(previous).id,
          circumcircle: circumcircle(subdivision.dest(base), subdivision.orig(base), subdivision.dest(rightCandidate)),
          value: check,
        });
        if (check <= EPSILON) break;
        const toDelete = rightCandidate;
        rightCandidate = previous;
        subdivision.deleteEdge(toDelete);
      }
    }

    const leftValid = valid(leftCandidate, base, subdivision);
    const rightValid = valid(rightCandidate, base, subdivision);
    trace?.detailed('candidate-selection', 'Selected valid left and right merge candidates.', {
      edgeIds: [base.baseId, leftCandidate.baseId, rightCandidate.baseId],
      leftCandidate: leftValid ? edgePointPair(leftCandidate, subdivision) : null,
      rightCandidate: rightValid ? edgePointPair(rightCandidate, subdivision) : null,
      activeBaseEdge: [subdivision.orig(base).id, subdivision.dest(base).id],
    });

    if (!leftValid && !rightValid) break;

    const useRight =
      !leftValid ||
      (rightValid &&
        inCircle(
          subdivision.dest(leftCandidate),
          subdivision.orig(leftCandidate),
          subdivision.orig(rightCandidate),
          subdivision.dest(rightCandidate),
        ) > EPSILON);

    base = useRight
      ? subdivision.connect(rightCandidate, subdivision.sym(base))
      : subdivision.connect(subdivision.sym(base), subdivision.sym(leftCandidate));
    trace?.detailed('base-edge-created', 'Advanced the merge chain with a new base edge.', {
      edgeIds: [base.baseId],
      activeBaseEdge: [subdivision.orig(base).id, subdivision.dest(base).id],
    });
  }

  trace?.phase('merge-complete', 'Completed merge of the two recursively built triangulations.', {
    subsetIds: subset.map((point) => point.id),
  });

  return { ldo, rdo };
}

function leftOf(point: Point2D, edge: DirectedEdge, subdivision: QuadEdgeSubdivision): boolean {
  const value = orientation(subdivision.orig(edge), subdivision.dest(edge), point);
  subdivisionTraceCheck(subdivision, edge, point, value, 'left');
  return value > EPSILON;
}

function rightOf(point: Point2D, edge: DirectedEdge, subdivision: QuadEdgeSubdivision): boolean {
  const value = orientation(subdivision.orig(edge), subdivision.dest(edge), point);
  subdivisionTraceCheck(subdivision, edge, point, value, 'right');
  return value < -EPSILON;
}

function valid(edge: DirectedEdge, base: DirectedEdge, subdivision: QuadEdgeSubdivision): boolean {
  if (edge.deleted) return false;
  return rightOf(subdivision.dest(edge), base, subdivision);
}

function edgePointPair(edge: DirectedEdge, subdivision: QuadEdgeSubdivision): readonly [string, string] {
  return [subdivision.orig(edge).id, subdivision.dest(edge).id];
}

function samePoint(a: Point2D, b: Point2D): boolean {
  return a.id === b.id;
}

function mustPoint(point: Point2D | undefined): Point2D {
  if (!point) throw new Error('Internal point indexing error.');
  return point;
}

function subdivisionTraceCheck(
  _subdivision: QuadEdgeSubdivision,
  _edge: DirectedEdge,
  _point: Point2D,
  _value: number,
  _side: 'left' | 'right',
): void {
  // Orientation checks are emitted at the higher-level steps to avoid noisy duplicate frames.
}
```

# src/trace/frames.ts
```ts
import type { DelaunayEdge, EdgeId, Point2D, PointId } from '../geometry/types';
import type { TraceArrow, TraceCircle, TraceDistance, TracePhase } from './events';

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
  readonly points: readonly Point2D[];
  readonly visibleEdges: readonly DelaunayEdge[];
  readonly highlightedEdges: readonly EdgeId[];
  readonly deletedEdges: readonly DelaunayEdge[];
  readonly activeSubset: readonly PointId[];
  readonly splitLines: readonly SplitLineFrame[];
  readonly activeBaseEdge: readonly [PointId, PointId] | null;
  readonly candidates: readonly CandidateFrame[];
  readonly activeTriangle: readonly [PointId, PointId, PointId] | null;
  readonly testedPoint: PointId | null;
  readonly circumcircle: TraceCircle | null;
  readonly nearestArrows: readonly TraceArrow[];
  readonly activeDistance: TraceDistance | null;
  readonly currentPhase: TracePhase | 'idle';
  readonly explanation: string;
}
```

# src/trace/projector.ts
```ts
import type { DelaunayEdge } from '../geometry/types';
import type { TraceEvent } from './events';
import type { CandidateFrame, SplitLineFrame, TraceFrame } from './frames';

export function projectTraceFrame(events: readonly TraceEvent[], eventIndex: number): TraceFrame {
  const clampedIndex = events.length === 0 ? -1 : Math.max(0, Math.min(eventIndex, events.length - 1));
  const edgeMap = new Map<string, DelaunayEdge>();
  const deletedMap = new Map<string, DelaunayEdge>();
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

export function projectAllFrames(events: readonly TraceEvent[]): readonly TraceFrame[] {
  if (events.length === 0) return [projectTraceFrame([], -1)];
  return events.map((_, index) => projectTraceFrame(events, index));
}
```

# src/geometry/extractAdjacency.ts
```ts
import type { AdjacencyGraph, DelaunayEdge, Point2D } from './types';
import type { TraceRecorder } from '../trace/recorder';

export function buildAdjacency(
  points: readonly Point2D[],
  edges: readonly DelaunayEdge[],
  trace?: TraceRecorder,
): AdjacencyGraph {
  const adjacency: AdjacencyGraph = new Map(points.map((point) => [point.id, new Set<string>()]));

  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  trace?.phase('adjacency-extracted', 'Extracted undirected adjacency from the Delaunay triangulation.', {
    edgeIds: edges.map((edge) => edge.id),
    edges,
  });
  return adjacency;
}
```

# src/geometry/nearestNeighbors.ts
```ts
import type { AdjacencyGraph, NearestNeighborResult, Point2D } from './types';
import { distance2, sameDistance } from './predicates';
import type { TraceRecorder } from '../trace/recorder';

export function nearestNeighborsFromAdjacency(
  points: readonly Point2D[],
  adjacency: AdjacencyGraph,
  trace?: TraceRecorder,
): readonly NearestNeighborResult[] {
  const byId = new Map(points.map((point) => [point.id, point]));
  const results: NearestNeighborResult[] = [];

  trace?.phase('nearest-neighbor-start', 'Started all nearest-neighbor search using only adjacent Delaunay vertices.', {
    pointIds: points.map((point) => point.id),
  });

  for (const point of points) {
    const neighbors = adjacency.get(point.id) ?? new Set<string>();
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestIds: string[] = [];

    for (const neighborId of neighbors) {
      const neighbor = byId.get(neighborId);
      if (!neighbor) continue;
      const candidateDistance = distance2(point, neighbor);
      trace?.detailed('nearest-candidate-check', 'Checked a Delaunay-adjacent nearest-neighbor candidate.', {
        pointIds: [point.id, neighbor.id],
        activeDistance: { from: point.id, to: neighbor.id, distance2: candidateDistance },
      });

      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        bestIds = [neighbor.id];
        trace?.detailed('nearest-improved', 'Found a closer adjacent candidate.', {
          pointIds: [point.id, neighbor.id],
          activeDistance: { from: point.id, to: neighbor.id, distance2: candidateDistance },
        });
      } else if (sameDistance(candidateDistance, bestDistance)) {
        bestIds.push(neighbor.id);
        trace?.detailed('nearest-tie', 'Found an equal-distance nearest-neighbor tie.', {
          pointIds: [point.id, neighbor.id],
          activeDistance: { from: point.id, to: neighbor.id, distance2: candidateDistance },
        });
      }
    }

    bestIds = bestIds.sort();
    results.push({ pointId: point.id, neighborIds: bestIds, distance2: bestDistance });
    const finalPayload = {
      pointIds: [point.id, ...bestIds],
      nearestArrows: bestIds.map((neighborId) => ({ from: point.id, to: neighborId })),
      ...(bestIds[0] ? { activeDistance: { from: point.id, to: bestIds[0], distance2: bestDistance } } : {}),
    };
    trace?.phase('nearest-final', `Final nearest neighbor(s) selected for ${point.label}.`, finalPayload);
  }

  trace?.phase('nearest-neighbor-complete', 'Completed all nearest-neighbor selections.', {
    nearestArrows: results.flatMap((result) => result.neighborIds.map((neighborId) => ({ from: result.pointId, to: neighborId }))),
  });

  return results;
}
```

# src/geometry/runAlgorithm.ts
```ts
import type { AlgorithmResult, GeometryResult, InputPoint } from './types';
import { buildDelaunayDivideAndConquer } from './delaunayDivideConquer';
import { buildAdjacency } from './extractAdjacency';
import { nearestNeighborsFromAdjacency } from './nearestNeighbors';
import { normalizeInput } from './normalize';
import { TraceRecorder, type TraceLevel } from '../trace/recorder';
import { validateNearestNeighbors } from '../validation/bruteForceNearest';

export function runNearestNeighborLab(
  input: readonly InputPoint[],
  traceLevel: TraceLevel,
): GeometryResult<AlgorithmResult> {
  const start = performance.now();
  const trace = new TraceRecorder(traceLevel);
  const normalized = normalizeInput(input, trace);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const triangulation = buildDelaunayDivideAndConquer(normalized.value.sortedPoints, trace);
  if (!triangulation.ok) {
    return { ok: false, error: triangulation.error };
  }

  const adjacency = buildAdjacency(normalized.value.points, triangulation.value.edges, trace);
  const nearestNeighbors = nearestNeighborsFromAdjacency(normalized.value.points, adjacency, trace);
  const validation = validateNearestNeighbors(normalized.value.points, nearestNeighbors);
  trace.phase('validation-complete', validation.message, { validation });

  const runtimeMs = performance.now() - start;
  trace.phase('algorithm-complete', 'Algorithm completed.', {
    edges: triangulation.value.edges,
    nearestArrows: nearestNeighbors.flatMap((result) => result.neighborIds.map((neighborId) => ({ from: result.pointId, to: neighborId }))),
    runtimeMs,
  });

  return {
    ok: true,
    value: {
      points: normalized.value.points,
      delaunayEdges: triangulation.value.edges,
      adjacency,
      nearestNeighbors,
      validation,
      trace: trace.events,
      runtimeMs,
    },
  };
}
```

# src/app/types.ts
```
```

# src/app/normalize.ts
```
```

# src/app/runLab.ts
```
```

# src/validation/bruteForceNearest.ts
```ts
import type { NearestNeighborResult, Point2D, ValidationResult } from '../geometry/types';
import { distance2, sameDistance } from '../geometry/predicates';

export const BRUTE_FORCE_LIMIT = 100;

export function bruteForceNearestNeighbors(points: readonly Point2D[]): readonly NearestNeighborResult[] {
  return points.map((point) => {
    let bestDistance = Number.POSITIVE_INFINITY;
    let neighborIds: string[] = [];

    for (const candidate of points) {
      if (candidate.id === point.id) continue;
      const candidateDistance = distance2(point, candidate);
      if (candidateDistance + 1e-9 < bestDistance) {
        bestDistance = candidateDistance;
        neighborIds = [candidate.id];
      } else if (sameDistance(candidateDistance, bestDistance)) {
        neighborIds.push(candidate.id);
      }
    }

    return { pointId: point.id, neighborIds: neighborIds.sort(), distance2: bestDistance };
  });
}

export function validateNearestNeighbors(
  points: readonly Point2D[],
  delaunayResults: readonly NearestNeighborResult[],
): ValidationResult {
  if (points.length > BRUTE_FORCE_LIMIT) {
    return { checked: false, ok: true, message: `Skipped brute-force validation for N > ${BRUTE_FORCE_LIMIT}.` };
  }

  const expected = bruteForceNearestNeighbors(points);
  const actualById = new Map(delaunayResults.map((result) => [result.pointId, result]));

  for (const expectedResult of expected) {
    const actual = actualById.get(expectedResult.pointId);
    if (!actual) {
      return { checked: true, ok: false, message: `Missing nearest-neighbor result for ${expectedResult.pointId}.` };
    }
    if (actual.neighborIds.join(',') !== expectedResult.neighborIds.join(',')) {
      return {
        checked: true,
        ok: false,
        message: `Validation failed for ${expectedResult.pointId}: expected ${expectedResult.neighborIds.join(', ')}, got ${actual.neighborIds.join(', ')}.`,
      };
    }
  }

  return { checked: true, ok: true, message: 'Validated against brute-force nearest neighbors.' };
}
```

# src/trace/events.ts
```ts
import type { DelaunayEdge, EdgeId, Point2D, PointId, ValidationResult } from '../geometry/types';

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

export interface TraceEventPayload {
  readonly points?: readonly Point2D[];
  readonly pointIds?: readonly PointId[];
  readonly subsetIds?: readonly PointId[];
  readonly leftIds?: readonly PointId[];
  readonly rightIds?: readonly PointId[];
  readonly edge?: DelaunayEdge;
  readonly edges?: readonly DelaunayEdge[];
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
  readonly validation?: ValidationResult;
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
```

# src/geometry/normalize.ts
```ts
import type { GeometryResult, InputPoint, Point2D } from './types';
import { allCollinear } from './predicates';
import type { TraceRecorder } from '../trace/recorder';

export interface NormalizedInput {
  readonly points: readonly Point2D[];
  readonly sortedPoints: readonly Point2D[];
}

export function normalizeInput(
  input: readonly InputPoint[],
  trace?: TraceRecorder,
): GeometryResult<NormalizedInput> {
  const errors: string[] = [];
  const seen = new Map<string, Point2D>();
  const points: Point2D[] = [];

  input.forEach((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      errors.push(`Point ${index + 1} has non-finite coordinates.`);
      return;
    }

    const key = `${point.x},${point.y}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      errors.push(`Duplicate point at (${point.x}, ${point.y}) matches ${existing?.label ?? 'an earlier point'}.`);
      return;
    }

    const normalized: Point2D = {
      id: point.id ?? `p${index + 1}`,
      label: point.id ?? `P${index + 1}`,
      x: point.x,
      y: point.y,
    };
    seen.set(key, normalized);
    points.push(normalized);
  });

  if (points.length < 2) {
    errors.push('At least two distinct points are required.');
  }

  if (points.length > 2 && allCollinear(points)) {
    errors.push('All-collinear inputs with more than two points are rejected by this lab build.');
  }

  if (errors.length > 0) {
    trace?.phase('input-rejected', 'Input normalization rejected unsupported data.', {
      points,
      details: errors,
    });
    return { ok: false, error: { message: 'Unsupported input.', details: errors } };
  }

  const sortedPoints = [...points].sort(comparePointsForDelaunay);
  trace?.phase('input-normalized', 'Input points were normalized with stable IDs.', { points });
  trace?.phase('points-sorted', 'Points were sorted by x-coordinate, then y-coordinate.', {
    pointIds: sortedPoints.map((point) => point.id),
  });

  return { ok: true, value: { points, sortedPoints } };
}

export function comparePointsForDelaunay(a: Point2D, b: Point2D): number {
  return a.x - b.x || a.y - b.y || a.id.localeCompare(b.id);
}
```

# src/geometry/quadEdge.ts
```ts
import type { DelaunayEdge, EdgeId, Point2D } from './types';
import type { TraceRecorder } from '../trace/recorder';

export interface DirectedEdge {
  readonly directedId: string;
  readonly baseId: EdgeId;
  readonly index: 0 | 1 | 2 | 3;
  next: DirectedEdge;
  origin: Point2D | null;
  deleted: boolean;
}

interface EdgeQuad {
  readonly id: EdgeId;
  readonly edges: readonly [DirectedEdge, DirectedEdge, DirectedEdge, DirectedEdge];
}

export class QuadEdgeSubdivision {
  private nextId = 1;
  private readonly quads: EdgeQuad[] = [];

  constructor(private readonly trace?: TraceRecorder) {}

  makeEdge(origin: Point2D, destination: Point2D): DirectedEdge {
    const id = `e${this.nextId++}`;
    const e0 = this.createDirected(id, 0, origin);
    const e1 = this.createDirected(id, 1, null);
    const e2 = this.createDirected(id, 2, destination);
    const e3 = this.createDirected(id, 3, null);
    e0.next = e0;
    e1.next = e3;
    e2.next = e2;
    e3.next = e1;
    const quad: EdgeQuad = { id, edges: [e0, e1, e2, e3] };
    this.quads.push(quad);
    this.trace?.detailed('edge-created', `Created Delaunay topology edge ${id}.`, {
      edge: { id, from: origin.id, to: destination.id },
      edgeIds: [id],
      pointIds: [origin.id, destination.id],
    });
    return e0;
  }

  splice(a: DirectedEdge, b: DirectedEdge): void {
    const alpha = this.rot(this.onext(a));
    const beta = this.rot(this.onext(b));
    const t1 = this.onext(b);
    const t2 = this.onext(a);
    const t3 = this.onext(beta);
    const t4 = this.onext(alpha);

    a.next = t1;
    b.next = t2;
    alpha.next = t3;
    beta.next = t4;

    this.trace?.detailed('edge-spliced', 'Applied quad-edge splice operation.', {
      edgeIds: [a.baseId, b.baseId],
    });
  }

  connect(a: DirectedEdge, b: DirectedEdge): DirectedEdge {
    const destination = this.dest(a);
    const origin = this.orig(b);
    const edge = this.makeEdge(destination, origin);
    this.splice(edge, this.lnext(a));
    this.splice(this.sym(edge), b);
    this.trace?.detailed('edge-connected', 'Connected two triangulation fronts.', {
      edge: { id: edge.baseId, from: destination.id, to: origin.id },
      edgeIds: [edge.baseId, a.baseId, b.baseId],
      pointIds: [destination.id, origin.id],
    });
    return edge;
  }

  deleteEdge(edge: DirectedEdge): void {
    this.trace?.detailed('edge-deleted', `Deleted invalid Delaunay edge ${edge.baseId}.`, {
      edgeIds: [edge.baseId],
      edge: { id: edge.baseId, from: this.orig(edge).id, to: this.dest(edge).id },
    });
    this.splice(edge, this.oprev(edge));
    this.splice(this.sym(edge), this.oprev(this.sym(edge)));
    this.quad(edge).edges.forEach((directed) => {
      directed.deleted = true;
    });
  }

  rot(edge: DirectedEdge): DirectedEdge {
    return this.quad(edge).edges[((edge.index + 1) % 4) as 0 | 1 | 2 | 3];
  }

  invRot(edge: DirectedEdge): DirectedEdge {
    return this.quad(edge).edges[((edge.index + 3) % 4) as 0 | 1 | 2 | 3];
  }

  sym(edge: DirectedEdge): DirectedEdge {
    return this.quad(edge).edges[((edge.index + 2) % 4) as 0 | 1 | 2 | 3];
  }

  onext(edge: DirectedEdge): DirectedEdge {
    return edge.next;
  }

  oprev(edge: DirectedEdge): DirectedEdge {
    return this.rot(this.onext(this.rot(edge)));
  }

  lnext(edge: DirectedEdge): DirectedEdge {
    return this.rot(this.onext(this.invRot(edge)));
  }

  rprev(edge: DirectedEdge): DirectedEdge {
    return this.onext(this.sym(edge));
  }

  orig(edge: DirectedEdge): Point2D {
    if (!edge.origin) {
      throw new Error(`Directed edge ${edge.directedId} has no primal origin.`);
    }
    return edge.origin;
  }

  dest(edge: DirectedEdge): Point2D {
    return this.orig(this.sym(edge));
  }

  extractEdges(): readonly DelaunayEdge[] {
    const edges: DelaunayEdge[] = [];
    for (const quad of this.quads) {
      const primal = quad.edges[0];
      if (primal.deleted) continue;
      const from = this.orig(primal).id;
      const to = this.dest(primal).id;
      if (from === to) continue;
      edges.push({ id: quad.id, from, to });
    }
    return edges.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  private createDirected(id: EdgeId, index: 0 | 1 | 2 | 3, origin: Point2D | null): DirectedEdge {
    const edge = {
      directedId: `${id}.${index}`,
      baseId: id,
      index,
      next: null as unknown as DirectedEdge,
      origin,
      deleted: false,
    };
    return edge;
  }

  private quad(edge: DirectedEdge): EdgeQuad {
    const quad = this.quads.find((candidate) => candidate.id === edge.baseId);
    if (!quad) {
      throw new Error(`Quad ${edge.baseId} was not found.`);
    }
    return quad;
  }
}
```

# src/geometry/predicates.ts
```ts
import type { Point2D } from './types';

export const EPSILON = 1e-9;

export function distance2(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function orientationSign(a: Point2D, b: Point2D, c: Point2D): -1 | 0 | 1 {
  const value = orientation(a, b, c);
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

export function inCircle(a: Point2D, b: Point2D, c: Point2D, d: Point2D): number {
  const ax = a.x - d.x;
  const ay = a.y - d.y;
  const bx = b.x - d.x;
  const by = b.y - d.y;
  const cx = c.x - d.x;
  const cy = c.y - d.y;

  const det =
    (ax * ax + ay * ay) * (bx * cy - by * cx) -
    (bx * bx + by * by) * (ax * cy - ay * cx) +
    (cx * cx + cy * cy) * (ax * by - ay * bx);

  return orientation(a, b, c) >= 0 ? det : -det;
}

export function insideCircumcircle(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  return inCircle(a, b, c, d) > EPSILON;
}

export function sameDistance(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

export function allCollinear(points: readonly Point2D[]): boolean {
  if (points.length < 3) return true;
  const first = points[0];
  const second = points.find((point) => point.x !== first?.x || point.y !== first?.y);
  if (!first || !second) return true;
  return points.every((point) => Math.abs(orientation(first, second, point)) <= EPSILON);
}

export function circumcircle(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): { readonly cx: number; readonly cy: number; readonly r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) <= EPSILON) return null;

  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const dx = cx - a.x;
  const dy = cy - a.y;
  return { cx, cy, r: Math.sqrt(dx * dx + dy * dy) };
}
```
