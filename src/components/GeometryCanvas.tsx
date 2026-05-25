import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { PointId, TracePoint } from '../trace/events';
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
  readonly from: TracePoint;
  readonly to: TracePoint;
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

    const pointById = new Map<PointId, TracePoint>(frame.points.map((point) => [point.id, point]));
    const activeSubset = new Set(frame.activeSubset);
    const highlightedEdges = new Set(frame.highlightedEdges);
    const lineFromIds = (id: string, fromId: PointId, toId: PointId, className: string): RenderLine[] => {
      const from = pointById.get(fromId);
      const to = pointById.get(toId);
      return from && to ? [{ id, from, to, className }] : [];
    };

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
      ? frame.visibleEdges.flatMap((edge) => lineFromIds(edge.id, edge.from, edge.to, highlightedEdges.has(edge.id) ? 'edge active' : 'edge normal'))
      : [];

    const deletedEdges: RenderLine[] = toggles.deletedEdges
      ? frame.deletedEdges.flatMap((edge) => lineFromIds(`deleted-${edge.id}`, edge.from, edge.to, 'edge deleted'))
      : [];

    const candidateEdges: RenderLine[] = toggles.candidateEdges
      ? frame.candidates.flatMap((candidate) => lineFromIds(
          `candidate-${candidate.side}-${candidate.from}-${candidate.to}`,
          candidate.from,
          candidate.to,
          `edge candidate ${candidate.side}`,
        ))
      : [];

    const baseEdge: RenderLine[] = frame.activeBaseEdge
      ? lineFromIds('active-base-edge', frame.activeBaseEdge[0], frame.activeBaseEdge[1], 'edge base active')
      : [];

    const nearestEdges: RenderLine[] = toggles.nearestArrows
      ? frame.nearestArrows.flatMap((arrow, index) => lineFromIds(`nearest-${index}-${arrow.from}-${arrow.to}`, arrow.from, arrow.to, 'edge nearest'))
      : [];

    const activeDistance: RenderLine[] = frame.activeDistance
      ? lineFromIds('active-distance', frame.activeDistance.from, frame.activeDistance.to, 'edge checked')
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
      const trianglePoints = [frame.activeTriangle.a, frame.activeTriangle.b, frame.activeTriangle.c]
        .map((id) => pointById.get(id))
        .filter((point): point is TracePoint => Boolean(point));
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
      .selectAll<SVGCircleElement, TracePoint>('circle')
      .data<TracePoint>(frame.points, (point) => point.id)
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
        .selectAll<SVGTextElement, TracePoint>('text')
        .data<TracePoint>(frame.points, (point) => point.id)
        .join('text')
        .attr('class', 'point-label')
        .attr('x', (point) => point.x + 8)
        .attr('y', (point) => point.y - 8)
        .text((point) => (point.sortedLabel ? `${point.label}/${point.sortedLabel}` : point.label));
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
