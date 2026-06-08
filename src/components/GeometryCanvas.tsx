import { pointer, select, zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3';
import {
  forwardRef,
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from 'react';
import type { CanvasInputMode, EdgeLabelOptions, PointLabelOptions, VisualizationToggles } from '../app/visualization';
import type { PointId, TraceEdge, TracePoint } from '../trace/events';
import type { TraceFrame } from '../trace/frames';

interface GeometryCanvasProps {
  readonly frame: TraceFrame;
  readonly toggles: VisualizationToggles;
  readonly pointLabelOptions: PointLabelOptions;
  readonly edgeLabelOptions: EdgeLabelOptions;
  readonly inputMode: CanvasInputMode;
  readonly width: number;
  readonly height: number;
  readonly onAddPoint: (x: number, y: number) => void;
}

export interface GeometryCanvasHandle {
  resetView: () => void;
  fitToPoints: () => void;
  getViewportBounds: () => { minX: number; maxX: number; minY: number; maxY: number };
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
const DRAG_THRESHOLD_PX = 4;
const MIN_ZOOM = 0.02;
const MAX_ZOOM = 24;
const MAX_POINT_LABELS = 500;
const MAX_EDGE_LABELS = 250;
const WORLD_GUIDE_EXTENT = 20_000;
const FIT_PADDING_PX = 48;

export const GeometryCanvas = memo(forwardRef<GeometryCanvasHandle, GeometryCanvasProps>(function GeometryCanvas({
  frame,
  toggles,
  pointLabelOptions,
  edgeLabelOptions,
  inputMode,
  width,
  height,
  onAddPoint,
}, ref) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<ZoomTransform>(zoomIdentity);
  const pointerGestureRef = useRef({ startX: 0, startY: 0, suppressClick: false });
  const markerId = sanitizeSvgId(useId());
  const clipPathId = sanitizeSvgId(useId());

  const pointById = new Map<PointId, TracePoint>(frame.points.map((point) => [point.id, point]));
  const activeSubset = new Set(frame.activeSubset);
  const highlightedEdges = new Set(frame.highlightedEdges);
  const worldTransform = `translate(${width / 2} ${height / 2}) scale(1 -1)`;

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
        toPairLine(`nearest-${index}-${arrow.from}-${arrow.to}`, arrow.from, arrow.to, pointById, 'edge nearest', `url(#${markerId})`),
      )
    : [];

  const activeDistance: RenderLine[] = frame.activeDistance
    ? toPairLine('active-distance', frame.activeDistance.from, frame.activeDistance.to, pointById, 'edge checked')
    : [];

  const lines = [...normalEdges, ...deletedEdges, ...candidateEdges, ...baseEdge, ...nearestEdges, ...activeDistance];

  const shouldRenderPointLabels = hasPointLabels(pointLabelOptions) && frame.points.length <= MAX_POINT_LABELS;
  const labelableEdgeCount = (toggles.delaunayEdges ? frame.visibleEdges.length : 0) + (toggles.deletedEdges ? frame.deletedEdges.length : 0);
  const shouldRenderEdgeLabels = (edgeLabelOptions.pairLabels || edgeLabelOptions.idLabels) && labelableEdgeCount <= MAX_EDGE_LABELS;

  const edgeLabels = !shouldRenderEdgeLabels
    ? []
    : [
        ...(toggles.delaunayEdges
          ? frame.visibleEdges.flatMap((edge) => buildEdgeLabel(edge, pointById, edgeLabelOptions, 'edge-label normal'))
          : []),
        ...(toggles.deletedEdges
          ? frame.deletedEdges.flatMap((edge) => buildEdgeLabel(edge, pointById, edgeLabelOptions, 'edge-label deleted'))
          : []),
      ];

  function applyZoomTransform(nextTransform: ZoomTransform): void {
    const svgElement = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgElement || !zoomBehavior) return;
    select(svgElement).call(zoomBehavior.transform, nextTransform);
  }

  useImperativeHandle(ref, () => ({
    resetView() {
      applyZoomTransform(zoomIdentity);
    },
    fitToPoints() {
      applyZoomTransform(buildFitTransform(frame.points, width, height));
    },
    getViewportBounds() {
      return viewportBoundsFromTransform(zoomTransformRef.current, width, height);
    },
  }), [frame.points, height, width]);

  useEffect(() => {
    const svgElement = svgRef.current;
    const viewportElement = viewportRef.current;
    if (!svgElement || !viewportElement) return;

    const svgSelection = select(svgElement);
    const viewportSelection = select(viewportElement);
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .extent([
        [0, 0],
        [width, height],
      ])
      .filter((event) => {
        if (event.type === 'dblclick') return false;

        const sourceEvent = event as MouseEvent | WheelEvent | TouchEvent;
        if ('button' in sourceEvent && sourceEvent.type !== 'wheel' && sourceEvent.button !== 0) {
          return false;
        }

        return true;
      })
      .on('start', (event) => {
        if (isDraggingSourceEvent(event.sourceEvent)) {
          svgElement.dataset.panning = 'true';
        }
      })
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        viewportSelection.attr('transform', event.transform.toString());
      })
      .on('end', (event) => {
        if (isDraggingSourceEvent(event.sourceEvent)) {
          svgElement.dataset.panning = 'false';
        }
      });

    zoomBehaviorRef.current = zoomBehavior;
    svgSelection.call(zoomBehavior);
    svgSelection.on('dblclick.zoom', null);
    viewportSelection.attr('transform', zoomTransformRef.current.toString());
    svgElement.dataset.panning = 'false';

    return () => {
      svgSelection.on('.zoom', null);
      svgElement.dataset.panning = 'false';
      zoomBehaviorRef.current = null;
    };
  }, [height, width]);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    pointerGestureRef.current.startX = event.clientX;
    pointerGestureRef.current.startY = event.clientY;
    pointerGestureRef.current.suppressClick = false;
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (pointerGestureRef.current.suppressClick) return;

    const distance = Math.hypot(event.clientX - pointerGestureRef.current.startX, event.clientY - pointerGestureRef.current.startY);
    if (distance >= DRAG_THRESHOLD_PX) {
      pointerGestureRef.current.suppressClick = true;
    }
  }

  function handleClick(event: ReactMouseEvent<SVGSVGElement>): void {
    const addPointEnabled = inputMode === 'add' || event.shiftKey;
    if (!addPointEnabled) return;

    if (pointerGestureRef.current.suppressClick) {
      pointerGestureRef.current.suppressClick = false;
      return;
    }

    const svgElement = svgRef.current;
    if (!svgElement) return;

    const [screenX, screenY] = pointer(event.nativeEvent, svgElement);
    const [baseX, baseY] = zoomTransformRef.current.invert([screenX, screenY]);
    const worldPoint = screenToWorld(baseX, baseY, width, height);
    onAddPoint(worldPoint.x, worldPoint.y);
  }

  return (
    <svg
      ref={svgRef}
      className="geometry-canvas"
      data-input-mode={inputMode}
      role="img"
      aria-label="Delaunay triangulation workspace"
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    >
      <defs>
        <clipPath id={clipPathId}>
          <rect width={width} height={height} />
        </clipPath>
        <marker
          id={markerId}
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

      <g clipPath={`url(#${clipPathId})`}>
        <g ref={viewportRef}>
          <g transform={worldTransform}>
            <g className="canvas-grid">
              {buildGridPositions(WORLD_GUIDE_EXTENT).map((x) => (
                <line
                  key={`grid-x-${x}`}
                  className={x === 0 ? 'canvas-grid-line axis' : 'canvas-grid-line'}
                  x1={x}
                  y1={-WORLD_GUIDE_EXTENT}
                  x2={x}
                  y2={WORLD_GUIDE_EXTENT}
                />
              ))}
              {buildGridPositions(WORLD_GUIDE_EXTENT).map((y) => (
                <line
                  key={`grid-y-${y}`}
                  className={y === 0 ? 'canvas-grid-line axis' : 'canvas-grid-line'}
                  x1={-WORLD_GUIDE_EXTENT}
                  y1={y}
                  x2={WORLD_GUIDE_EXTENT}
                  y2={y}
                />
              ))}
            </g>

            <g className="canvas-axes">
              <line className="canvas-axis" x1={0} y1={-WORLD_GUIDE_EXTENT} x2={0} y2={WORLD_GUIDE_EXTENT} />
              <line className="canvas-axis" x1={-WORLD_GUIDE_EXTENT} y1={0} x2={WORLD_GUIDE_EXTENT} y2={0} />
            </g>

            {toggles.splitLines ? (
              <g className="split-lines">
                {frame.splitLines.map((line) => (
                  <line
                    key={line.id}
                    className="split-line"
                    x1={line.x}
                    x2={line.x}
                    y1={-WORLD_GUIDE_EXTENT}
                    y2={WORLD_GUIDE_EXTENT}
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
                    transform={`translate(${label.x} ${label.y}) scale(1 -1)`}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {label.lines.map((line, index) => (
                      <tspan key={`${label.id}-${line}`} x={0} dy={index === 0 ? 0 : 12}>
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

            {shouldRenderPointLabels ? (
              <g className="labels">
                {frame.points.map((point) => {
                  const labelLines = buildPointLabelLines(point, pointLabelOptions);
                  if (labelLines.length === 0) return null;

                  const x = point.x + 10;
                  const y = point.y + 10 + (labelLines.length - 1) * 13;

                  return (
                    <text key={point.id} className="point-label" transform={`translate(${x} ${y}) scale(1 -1)`}>
                      {labelLines.map((line, index) => (
                        <tspan key={`${point.id}-${line}`} x={0} dy={index === 0 ? 0 : 13}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                })}
              </g>
            ) : null}
          </g>
        </g>
      </g>
    </svg>
  );
}));

GeometryCanvas.displayName = 'GeometryCanvas';

function sanitizeSvgId(id: string): string {
  return id.replace(/:/g, '');
}

function isDraggingSourceEvent(event: unknown): boolean {
  if (event instanceof WheelEvent) return false;
  return event instanceof MouseEvent || event instanceof PointerEvent || event instanceof TouchEvent;
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

function buildGridPositions(extent: number): readonly number[] {
  return Array.from({ length: Math.floor((extent * 2) / GRID_STEP) + 1 }, (_, index) => -extent + index * GRID_STEP);
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
): readonly string[] {
  const lines: string[] = [];
  if (options.inputLabels) lines.push(point.label);
  if (options.sortedLabels && point.sortedLabel) lines.push(point.sortedLabel);
  if (options.coordinates) {
    const plane = toPlaneCoordinates(point);
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

function toPlaneCoordinates(point: TracePoint): { x: number; y: number } {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function screenToWorld(screenX: number, screenY: number, width: number, height: number): { x: number; y: number } {
  return {
    x: screenX - width / 2,
    y: height / 2 - screenY,
  };
}

function worldToBaseScreen(point: TracePoint, width: number, height: number): { x: number; y: number } {
  return {
    x: point.x + width / 2,
    y: height / 2 - point.y,
  };
}

function buildFitTransform(points: readonly TracePoint[], width: number, height: number): ZoomTransform {
  if (points.length === 0) {
    return zoomIdentity;
  }

  if (points.length === 1) {
    const center = worldToBaseScreen(points[0]!, width, height);
    return zoomIdentity.translate(width / 2 - center.x, height / 2 - center.y);
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const topLeft = worldToBaseScreen({ x: minX, y: maxY } as TracePoint, width, height);
  const bottomRight = worldToBaseScreen({ x: maxX, y: minY } as TracePoint, width, height);
  const boundsWidth = Math.max(bottomRight.x - topLeft.x, GRID_STEP);
  const boundsHeight = Math.max(bottomRight.y - topLeft.y, GRID_STEP);
  const availableWidth = Math.max(width - FIT_PADDING_PX * 2, 1);
  const availableHeight = Math.max(height - FIT_PADDING_PX * 2, 1);
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight)));
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const centerY = (topLeft.y + bottomRight.y) / 2;

  return zoomIdentity
    .translate(width / 2 - scale * centerX, height / 2 - scale * centerY)
    .scale(scale);
}

function viewportBoundsFromTransform(transform: ZoomTransform, width: number, height: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const [topLeftX, topLeftY] = transform.invert([0, 0]);
  const [bottomRightX, bottomRightY] = transform.invert([width, height]);
  const topLeft = screenToWorld(topLeftX, topLeftY, width, height);
  const bottomRight = screenToWorld(bottomRightX, bottomRightY, width, height);

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}
