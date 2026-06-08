import { describe, expect, it } from 'vitest';
import { bruteForceNearestNeighbors, validateNearestNeighbors } from '../src/validation/bruteForceNearest';
import { runLab } from '../src/app/runLab';
import type { AppPoint } from '../src/app/types';
import { runGeometryCore } from '../src/geometry/run-geometry-core';
import { delaunayTriangulation } from '../src/geometry/delaunay-triangulation';
import type { Point } from '../src/geometry/types';

function p(x: number, y: number): Point {
  return { x, y };
}

function appPoints(points: readonly Point[]): readonly AppPoint[] {
  return points.map((point, index) => ({ id: `p${index + 1}`, name: `S${index + 1}`, x: point.x, y: point.y, sortedIndex: null }));
}

function expectNearestNeighborsToMatch(points: readonly Point[], label: string): void {
  const result = runGeometryCore(points);
  const validation = validateNearestNeighbors(points, result.nearestNeighbors);
  expect(validation, label).toMatchObject({ checked: true, ok: true });
}

function generateUniqueRandomPoints(count: number, seed: number): readonly Point[] {
  const next = mulberry32(seed);
  const points: Point[] = [];
  const used = new Set<string>();

  while (points.length < count) {
    const x = Math.round((next() * 2 - 1) * 1_000);
    const y = Math.round((next() * 2 - 1) * 1_000);
    const key = `${x}:${y}`;
    if (used.has(key)) continue;
    used.add(key);
    points.push({ x, y });
  }

  return points;
}

function generateCollinearPoints(count: number, seed: number): readonly Point[] {
  const next = mulberry32(seed);
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: -1 },
    { x: -3, y: 2 },
  ] as const;
  const direction = directions[seed % directions.length] ?? directions[0];
  const origin = {
    x: Math.round((next() * 2 - 1) * 100),
    y: Math.round((next() * 2 - 1) * 100),
  };
  const offsets = new Set<number>();

  while (offsets.size < count) {
    offsets.add(Math.round((next() * 2 - 1) * 200));
  }

  return [...offsets]
    .sort((a, b) => a - b)
    .map((offset) => ({
      x: origin.x + direction.x * offset,
      y: origin.y + direction.y * offset,
    }));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), state | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
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

  it('supports all-collinear inputs and preserves nearest-neighbor ties', () => {
    const input = [
      p(0, 0),
      p(2, 0),
      p(4, 0),
      p(9, 0),
    ];
    const result = runLab(appPoints(input), 'phase');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.edges).toHaveLength(3);
      expect(result.value.validation).toMatchObject({ checked: true, ok: true });
      expect(result.value.nearestNeighbors.find((item) => item.point === 1)?.neighbors).toEqual([0, 2]);
      expect(result.value.nearestNeighbors.find((item) => item.point === 2)?.neighbors).toEqual([1]);
    }
  });

  it('uses a sorted chain triangulation for all-collinear geometry inputs', () => {
    const triangulation = delaunayTriangulation([
      p(0, 0),
      p(0, 5),
      p(0, 8),
      p(0, 11),
    ]);

    expect(triangulation.edges).toEqual([
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ]);
  });

  it('rejects duplicate coordinates consistently in geometry core and app flow', () => {
    const input = [p(3, 4), p(3, 4), p(8, 9)];

    expect(() => runGeometryCore(input)).toThrow(/Duplicate points are unsupported/);

    const result = runLab(appPoints(input), 'off');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Unsupported input.');
      expect(result.error.details?.join(' ')).toContain('Duplicate coordinates are unsupported');
    }
  });

  it('handles degenerate and near-degenerate supported small cases', () => {
    const cases = [
      { label: 'two points', points: [p(0, 0), p(3, 4)] },
      { label: 'three collinear points', points: [p(0, 0), p(5, 0), p(9, 0)] },
      { label: 'near-collinear triangle', points: [p(0, 0), p(1, 0), p(2, 1e-6)] },
      { label: 'near-collinear four-point set', points: [p(0, 0), p(1, 1e-6), p(2, 0), p(3, -1e-6)] },
      { label: 'small tie case', points: [p(0, 0), p(2, 0), p(1, 1)] },
    ] as const;

    for (const testCase of cases) {
      expectNearestNeighborsToMatch(testCase.points, testCase.label);
    }
  });

  it('passes reproducible randomized differential tests for supported non-collinear inputs', () => {
    const seeds = [0x51ec7ed, 0x5eedc0de, 0x12345678, 0xcafebabe, 0x0badf00d];
    const counts = [2, 3, 4, 5, 8, 16, 32, 64];

    for (const seed of seeds) {
      for (const count of counts) {
        const points = generateUniqueRandomPoints(count, seed + count);
        expectNearestNeighborsToMatch(points, `seed=${seed} count=${count}`);
      }
    }
  });

  it('passes reproducible randomized differential tests for supported all-collinear inputs', () => {
    const seeds = [11, 29, 47, 71];
    const counts = [2, 3, 5, 9, 17, 40];

    for (const seed of seeds) {
      for (const count of counts) {
        const points = generateCollinearPoints(count, seed + count);
        expectNearestNeighborsToMatch(points, `collinear seed=${seed} count=${count}`);
      }
    }
  });
});
