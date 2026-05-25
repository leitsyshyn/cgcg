import { type MouseEvent as ReactMouseEvent, useRef } from 'react';
import type { PointId, TraceEdge, TracePoint } from '../trace/events';
import type { TraceFrame } from '../trace/frames';
import type { EdgeLabelOptions, PointLabelOptions, VisualizationToggles } from '../app/visualization';

interface GeometryCanvasProps {
  readonly frame: TraceFrame;
  readonly toggles: VisualizationToggles;
  readonly pointLabelOptions: PointLabelOptions;
  readonly edgeLabelOptions: EdgeLabelOptions;
  readonly width: number;
  readonly height: number;
  readonly onAddPoint: (x: number, y: number) => void;
}

interface RenderLine {
  readonly id: string;
  readonly from: TracePoint;
  readonly to: TracePoint;
  readonly className: string;
  readonly markerEnd?: string;
}

interface EdgeLabel {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
  readonly className: string;
}

const GRID_STEP = 40;
const EDGE_LABEL_OFFSET = 12;

export function GeometryCanvas({
  frame,
  toggles,
  pointLabelOptions,
  edgeLabelOptions,
  width,
  height,
  onAddPoint,
}: GeometryCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const pointById = new Map<PointId, TracePoint>(frame.points.map((point) => [point.id, point]));
  const activeSubset = new Set(frame.activeSubset);
  const highlightedEdges = new Set(frame.highlightedEdges);

  const normalEdges: RenderLine[] = toggles.delaunayEdges
    ? frame.visibleEdges.flatMap((edge) => toLine(edge.id, edge, pointById, highlightedEdges.has(edge.id) ? 'edge active' : 'edge normal'))
    : [];

  const deletedEdges: RenderLine[] = toggles.deletedEdges
    ? frame.deletedEdges.flatMap((edge) => toLine(`deleted-${edge.id}`, edge, pointById, 'edge deleted'))
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
    ? toPairLine('active-base-edge', frame.activeBaseEdge[0], frame.activeBaseEdge[1], pointById, 'edge base active')
    : [];

  const nearestEdges: RenderLine[] = toggles.nearestArrows
    ? frame.nearestArrows.flatMap((arrow, index) =>
        toPairLine(`nearest-${index}-${arrow.from}-${arrow.to}`, arrow.from, arrow.to, pointById, 'edge nearest', 'url(#canvas-arrow-head)'),
      )
    : [];

  const activeDistance: RenderLine[] = frame.activeDistance
    ? toPairLine('active-distance', frame.activeDistance.from, frame.activeDistance.to, pointById, 'edge checked')
    : [];

  const lines = [...normalEdges, ...deletedEdges, ...candidateEdges, ...baseEdge, ...nearestEdges, ...activeDistance];

  const edgeLabels = !edgeLabelOptions.pairLabels && !edgeLabelOptions.idLabels
    ? []
    : [
        ...(toggles.delaunayEdges
          ? frame.visibleEdges.flatMap((edge) => buildEdgeLabel(edge, pointById, edgeLabelOptions, 'edge-label normal'))
          : []),
        ...(toggles.deletedEdges
          ? frame.deletedEdges.flatMap((edge) => buildEdgeLabel(edge, pointById, edgeLabelOptions, 'edge-label deleted'))
          : []),
      ];

  function handleClick(event: ReactMouseEvent<SVGSVGElement>): void {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    onAddPoint((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
  }

  return (
    <svg
      ref={svgRef}
      className="geometry-canvas"
      role="img"
      aria-label="Delaunay triangulation workspace"
      viewBox={`0 0 ${width} ${height}`}
      onClick={handleClick}
    >
      <defs>
        <marker
          id="canvas-arrow-head"
          viewBox="0 -5 10 10"
          refX="13"
          refY="0"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,-5L10,0L0,5" className="arrow-head" />
        </marker>
      </defs>

      <rect className="canvas-bg" width={width} height={height} />

      <g className="canvas-grid">
        {buildGridPositions(width).map((x) => (
          <line key={`grid-x-${x}`} className={x === width / 2 ? 'canvas-grid-line axis' : 'canvas-grid-line'} x1={x} y1={0} x2={x} y2={height} />
        ))}
        {buildGridPositions(height).map((y) => (
          <line key={`grid-y-${y}`} className={y === height / 2 ? 'canvas-grid-line axis' : 'canvas-grid-line'} x1={0} y1={y} x2={width} y2={y} />
        ))}
      </g>

      <g className="canvas-axes">
        <line className="canvas-axis" x1={width / 2} y1={0} x2={width / 2} y2={height} />
        <line className="canvas-axis" x1={0} y1={height / 2} x2={width} y2={height / 2} />
      </g>

      {toggles.splitLines ? (
        <g className="split-lines">
          {frame.splitLines.map((line) => (
            <line
              key={line.id}
              className="split-line"
              x1={line.x}
              x2={line.x}
              y1={0}
              y2={height}
              strokeDasharray={`${4 + line.depth} 6`}
            />
          ))}
        </g>
      ) : null}

      {frame.activeTriangle ? (
        <polygon
          className="active-triangle"
          points={toTrianglePoints(frame.activeTriangle.a, frame.activeTriangle.b, frame.activeTriangle.c, pointById)}
        />
      ) : null}

      {toggles.circumcircles && frame.circumcircle ? (
        <circle className="circumcircle" cx={frame.circumcircle.cx} cy={frame.circumcircle.cy} r={frame.circumcircle.r} />
      ) : null}

      <g className="edges">
        {lines.map((line) => (
          <line
            key={line.id}
            className={line.className}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            markerEnd={line.markerEnd}
          />
        ))}
      </g>

      {edgeLabels.length > 0 ? (
        <g className="edge-labels">
          {edgeLabels.map((label) => (
            <text
              key={label.id}
              className={label.className}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label.lines.map((line, index) => (
                <tspan key={`${label.id}-${line}`} x={label.x} dy={index === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          ))}
        </g>
      ) : null}

      <g className="points">
        {frame.points.map((point) => {
          const classes = ['point'];
          if (activeSubset.has(point.id)) classes.push('active');
          if (frame.testedPoint === point.id) classes.push('checked');

          return (
            <circle
              key={point.id}
              className={classes.join(' ')}
              cx={point.x}
              cy={point.y}
              r={activeSubset.has(point.id) ? 5.5 : 4.5}
            />
          );
        })}
      </g>

      {hasPointLabels(pointLabelOptions) ? (
        <g className="labels">
          {frame.points.map((point) => {
            const labelLines = buildPointLabelLines(point, pointLabelOptions, width, height);
            if (labelLines.length === 0) return null;

            const x = point.x + 10;
            const y = Math.max(14, point.y - 10 - (labelLines.length - 1) * 13);

            return (
              <text key={point.id} className="point-label" x={x} y={y}>
                {labelLines.map((line, index) => (
                  <tspan key={`${point.id}-${line}`} x={x} dy={index === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}

function toLine(
  id: string,
  edge: TraceEdge,
  pointById: ReadonlyMap<PointId, TracePoint>,
  className: string,
  markerEnd?: string,
): RenderLine[] {
  return toPairLine(id, edge.from, edge.to, pointById, className, markerEnd);
}

function toPairLine(
  id: string,
  fromId: PointId,
  toId: PointId,
  pointById: ReadonlyMap<PointId, TracePoint>,
  className: string,
  markerEnd?: string,
): RenderLine[] {
  const from = pointById.get(fromId);
  const to = pointById.get(toId);
  if (!from || !to) return [];
  return [{ id, from, to, className, ...(markerEnd ? { markerEnd } : {}) }];
}

function buildGridPositions(limit: number): readonly number[] {
  return Array.from({ length: Math.floor(limit / GRID_STEP) + 1 }, (_, index) => index * GRID_STEP);
}

function toTrianglePoints(
  aId: PointId,
  bId: PointId,
  cId: PointId,
  pointById: ReadonlyMap<PointId, TracePoint>,
): string | undefined {
  const a = pointById.get(aId);
  const b = pointById.get(bId);
  const c = pointById.get(cId);
  if (!a || !b || !c) return undefined;
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`;
}

function hasPointLabels(options: PointLabelOptions): boolean {
  return options.inputLabels || options.sortedLabels || options.coordinates;
}

function buildPointLabelLines(
  point: TracePoint,
  options: PointLabelOptions,
  width: number,
  height: number,
): readonly string[] {
  const lines: string[] = [];
  if (options.inputLabels) lines.push(point.label);
  if (options.sortedLabels && point.sortedLabel) lines.push(point.sortedLabel);
  if (options.coordinates) {
    const plane = toPlaneCoordinates(point, width, height);
    lines.push(`(${plane.x}; ${plane.y})`);
  }
  return lines;
}

function buildEdgeLabel(
  edge: TraceEdge,
  pointById: ReadonlyMap<PointId, TracePoint>,
  options: EdgeLabelOptions,
  className: string,
): EdgeLabel[] {
  const from = pointById.get(edge.from);
  const to = pointById.get(edge.to);
  if (!from || !to) return [];

  const lines = buildEdgeLabelLines(edge, from, to, options);
  if (lines.length === 0) return [];

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;

  return [{
    id: `${edge.id}-label`,
    x: (from.x + to.x) / 2 + normalX * EDGE_LABEL_OFFSET,
    y: (from.y + to.y) / 2 + normalY * EDGE_LABEL_OFFSET,
    lines,
    className,
  }];
}

function buildEdgeLabelLines(
  edge: TraceEdge,
  from: TracePoint,
  to: TracePoint,
  options: EdgeLabelOptions,
): readonly string[] {
  const lines: string[] = [];
  if (options.pairLabels) lines.push(buildEdgePairLabel(from, to));
  if (options.idLabels) lines.push(edge.id.toUpperCase());
  return lines;
}

function buildEdgePairLabel(from: TracePoint, to: TracePoint): string {
  const endpoints = [preferredEdgePointLabel(from), preferredEdgePointLabel(to)].sort(comparePointLabel);
  return `${endpoints[0]}-${endpoints[1]}`;
}

function preferredEdgePointLabel(point: TracePoint): string {
  return point.sortedLabel ?? point.label;
}

function comparePointLabel(a: string, b: string): number {
  const aMatch = a.match(/^(?:P|S)(\d+)$/);
  const bMatch = b.match(/^(?:P|S)(\d+)$/);
  if (aMatch && bMatch) {
    return Number(aMatch[1]) - Number(bMatch[1]);
  }
  return a.localeCompare(b);
}

function toPlaneCoordinates(point: TracePoint, width: number, height: number): { x: number; y: number } {
  return {
    x: Math.round(point.x - width / 2),
    y: Math.round(height / 2 - point.y),
  };
}
