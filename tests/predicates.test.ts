import { describe, expect, it } from 'vitest';
import { distanceSquared, inCircle, orientation, orientationSign } from '../src/geometry/predicates';
import type { Point } from '../src/geometry/types';

function p(x: number, y: number): Point {
  return { x, y };
}

describe('geometry predicates', () => {
  it('computes squared Euclidean distance without square root', () => {
    expect(distanceSquared(p(0, 0), p(3, 4))).toBe(25);
  });

  it('computes orientation sign', () => {
    const a = p(0, 0);
    const b = p(2, 0);
    expect(orientation(a, b, p(1, 1))).toBeGreaterThan(0);
    expect(orientationSign(a, b, p(1, -1))).toBe(-1);
    expect(orientationSign(a, b, p(1, 0))).toBe(0);
  });

  it('computes the in-circle predicate', () => {
    const a = p(0, 0);
    const b = p(1, 0);
    const c = p(0, 1);
    expect(inCircle(a, b, c, p(0.25, 0.25))).toBeGreaterThan(0);
    expect(Math.abs(inCircle(a, b, c, p(1, 1)))).toBeLessThan(1e-9);
    expect(inCircle(a, b, c, p(2, 2))).toBeLessThan(0);
  });
});
