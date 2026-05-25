import type { Circle, Point } from './types';

export const EPSILON = 1e-9;

export function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function orientationSign(a: Point, b: Point, c: Point): -1 | 0 | 1 {
  const value = orientation(a, b, c);
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

export function inCircle(a: Point, b: Point, c: Point, d: Point): number {
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

export function insideCircumcircle(a: Point, b: Point, c: Point, d: Point): boolean {
  return inCircle(a, b, c, d) > EPSILON;
}

export function sameDistance(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

export function collinear(points: readonly Point[]): boolean {
  if (points.length < 3) return true;
  const first = points[0];
  const second = points.find((point) => point.x !== first?.x || point.y !== first?.y);
  if (!first || !second) return true;
  return points.every((point) => Math.abs(orientation(first, second, point)) <= EPSILON);
}

export function circumcircle(a: Point, b: Point, c: Point): Circle | null {
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
