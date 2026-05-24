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
