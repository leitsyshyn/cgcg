import { describe, expect, it } from 'vitest';
import { bruteForceNearestNeighbors, validateNearestNeighbors } from '../src/validation/bruteForceNearest';
import { runLab } from '../src/app/runLab';
import type { AppPoint } from '../src/app/types';
import type { Point } from '../src/geometry/types';

function p(x: number, y: number): Point {
  return { x, y };
}

function appPoints(points: readonly Point[]): readonly AppPoint[] {
  return points.map((point, index) => ({ id: `p${index + 1}`, name: `S${index + 1}`, point, sortedIndex: null }));
}

describe('nearest-neighbor calculation', () => {
  it('computes brute-force nearest neighbors with ties', () => {
    const results = bruteForceNearestNeighbors([
      p(0, 0),
      p(2, 0),
      p(1, 0),
    ]);
    expect(results.find((result) => result.point === 2)?.neighbors).toEqual([0, 1]);
  });

  it('finds Delaunay-based nearest neighbors for a simple nondegenerate set', () => {
    const input = appPoints([
      p(80, 80),
      p(220, 90),
      p(160, 210),
      p(360, 150),
      p(300, 300),
    ]);
    const result = runLab(
      input,
      'phase',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.edges.length).toBeGreaterThan(0);
      expect(result.value.validation.ok).toBe(true);
      expect(validateNearestNeighbors(result.value.triangulation.points, result.value.nearestNeighbors).ok).toBe(true);
    }
  });

  it('validates Delaunay-based nearest neighbors on deterministic demo inputs', () => {
    const inputs = [
      [
        p(120, 120), p(240, 80), p(390, 150), p(200, 260), p(420, 320), p(90, 360),
      ],
      [
        p(80, 90), p(210, 120), p(310, 70), p(150, 230), p(280, 260), p(420, 210), p(360, 380), p(120, 410),
      ],
    ];

    for (const input of inputs) {
      const result = runLab(appPoints(input), 'phase');
      expect(result.ok).toBe(true);
      if (result.ok) {
        const edges = result.value.edges.map((edge) => `${edge.from}-${edge.to}`).join(' ');
        expect(result.value.validation, `${result.value.validation.message}; edges: ${edges}`).toMatchObject({ ok: true });
      }
    }
  });
});
