import { describe, expect, it } from 'vitest';
import { distance2, inCircle, orientation, orientationSign } from '../src/geometry/predicates';
import type { Point2D } from '../src/geometry/types';

function p(id: string, x: number, y: number): Point2D {
  return { id, label: id.toUpperCase(), x, y };
}

describe('geometry predicates', () => {
  it('computes squared Euclidean distance without square root', () => {
    expect(distance2(p('a', 0, 0), p('b', 3, 4))).toBe(25);
  });

  it('computes orientation sign', () => {
    const a = p('a', 0, 0);
    const b = p('b', 2, 0);
    expect(orientation(a, b, p('c', 1, 1))).toBeGreaterThan(0);
    expect(orientationSign(a, b, p('d', 1, -1))).toBe(-1);
    expect(orientationSign(a, b, p('e', 1, 0))).toBe(0);
  });

  it('computes the in-circle predicate', () => {
    const a = p('a', 0, 0);
    const b = p('b', 1, 0);
    const c = p('c', 0, 1);
    expect(inCircle(a, b, c, p('inside', 0.25, 0.25))).toBeGreaterThan(0);
    expect(Math.abs(inCircle(a, b, c, p('on', 1, 1)))).toBeLessThan(1e-9);
    expect(inCircle(a, b, c, p('outside', 2, 2))).toBeLessThan(0);
  });
});
