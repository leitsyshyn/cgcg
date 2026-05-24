import { describe, expect, it } from 'vitest';
import { bruteForceNearestNeighbors, validateNearestNeighbors } from '../src/validation/bruteForceNearest';
import { runNearestNeighborLab } from '../src/geometry/runAlgorithm';
import type { Point2D } from '../src/geometry/types';

function p(id: string, x: number, y: number): Point2D {
  return { id, label: id.toUpperCase(), x, y };
}

describe('nearest-neighbor calculation', () => {
  it('computes brute-force nearest neighbors with ties', () => {
    const results = bruteForceNearestNeighbors([
      p('a', 0, 0),
      p('b', 2, 0),
      p('c', 1, 0),
    ]);
    expect(results.find((result) => result.pointId === 'c')?.neighborIds).toEqual(['a', 'b']);
  });

  it('finds Delaunay-based nearest neighbors for a simple nondegenerate set', () => {
    const result = runNearestNeighborLab(
      [
        { id: 'a', x: 80, y: 80 },
        { id: 'b', x: 220, y: 90 },
        { id: 'c', x: 160, y: 210 },
        { id: 'd', x: 360, y: 150 },
        { id: 'e', x: 300, y: 300 },
      ],
      'phase',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.delaunayEdges.length).toBeGreaterThan(0);
      expect(result.value.validation.ok).toBe(true);
      expect(validateNearestNeighbors(result.value.points, result.value.nearestNeighbors).ok).toBe(true);
    }
  });

  it('validates Delaunay-based nearest neighbors on deterministic demo inputs', () => {
    const inputs = [
      [
        { id: 'p1', x: 120, y: 120 },
        { id: 'p2', x: 240, y: 80 },
        { id: 'p3', x: 390, y: 150 },
        { id: 'p4', x: 200, y: 260 },
        { id: 'p5', x: 420, y: 320 },
        { id: 'p6', x: 90, y: 360 },
      ],
      [
        { id: 'p1', x: 80, y: 90 },
        { id: 'p2', x: 210, y: 120 },
        { id: 'p3', x: 310, y: 70 },
        { id: 'p4', x: 150, y: 230 },
        { id: 'p5', x: 280, y: 260 },
        { id: 'p6', x: 420, y: 210 },
        { id: 'p7', x: 360, y: 380 },
        { id: 'p8', x: 120, y: 410 },
      ],
    ];

    for (const input of inputs) {
      const result = runNearestNeighborLab(input, 'phase');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const edges = result.value.delaunayEdges.map((edge) => `${edge.from}-${edge.to}`).join(' ');
        expect(result.value.validation, `${result.value.validation.message}; edges: ${edges}`).toMatchObject({ ok: true });
      }
    }
  });
});
