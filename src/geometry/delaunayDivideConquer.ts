import type { DirectedEdge, Point, Triangulation } from './types';
import { EPSILON, inCircle, orientation } from './predicates';
import { QuadEdgeSubdivision } from './quadEdge';

interface SortedPoint extends Point {
  readonly index: number;
}

interface HullEdges {
  readonly ldo: DirectedEdge;
  readonly rdo: DirectedEdge;
}

export function sortedOrder(points: readonly Point[]): readonly number[] {
  return points
    .map((_, index) => index)
    .sort((a, b) => pointOrder(points[a], points[b]));
}

export function delaunayTriangulation(points: readonly Point[]): Triangulation {
  if (points.length < 2) {
    throw new Error('At least two points are required for Delaunay triangulation.');
  }

  const sortedPoints = sortedOrder(points).map((index) => ({ ...points[index], index }));
  const subdivision = new QuadEdgeSubdivision();
  divide(sortedPoints, 0, sortedPoints.length, subdivision, points);

  return {
    points,
    edges: subdivision.edges(),
  };
}

function divide(
  sortedPoints: readonly SortedPoint[],
  start: number,
  end: number,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
): HullEdges {
  const count = end - start;

  if (count === 2) {
    const a = sortedPoints[start];
    const b = sortedPoints[start + 1];
    if (!a || !b) throw new Error('Invalid two-point base case.');
    const edge = subdivision.makeEdge(a.index, b.index);
    return { ldo: edge, rdo: subdivision.sym(edge) };
  }

  if (count === 3) {
    const aPoint = sortedPoints[start];
    const bPoint = sortedPoints[start + 1];
    const cPoint = sortedPoints[start + 2];
    if (!aPoint || !bPoint || !cPoint) throw new Error('Invalid three-point base case.');

    const a = subdivision.makeEdge(aPoint.index, bPoint.index);
    const b = subdivision.makeEdge(bPoint.index, cPoint.index);
    subdivision.splice(subdivision.sym(a), b);

    const orient = orientation(aPoint, bPoint, cPoint);
    if (orient > EPSILON) {
      subdivision.connect(b, a);
      return { ldo: a, rdo: subdivision.sym(b) };
    }

    if (orient < -EPSILON) {
      const c = subdivision.connect(b, a);
      return { ldo: subdivision.sym(c), rdo: c };
    }

    return { ldo: a, rdo: subdivision.sym(b) };
  }

  const middle = start + Math.floor(count / 2);
  const left = divide(sortedPoints, start, middle, subdivision, points);
  const right = divide(sortedPoints, middle, end, subdivision, points);
  return merge(left, right, subdivision, points);
}

function merge(
  left: HullEdges,
  right: HullEdges,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
): HullEdges {
  let ldi = left.rdo;
  let rdi = right.ldo;

  while (true) {
    if (leftOf(subdivision.orig(rdi), ldi, subdivision, points)) {
      ldi = subdivision.lnext(ldi);
      continue;
    }

    if (rightOf(subdivision.orig(ldi), rdi, subdivision, points)) {
      rdi = subdivision.rprev(rdi);
      continue;
    }

    break;
  }

  let base = subdivision.connect(subdivision.sym(rdi), ldi);
  let ldo = left.ldo;
  let rdo = right.rdo;

  if (subdivision.orig(ldi) === subdivision.orig(ldo)) {
    ldo = subdivision.sym(base);
  }
  if (subdivision.orig(rdi) === subdivision.orig(rdo)) {
    rdo = base;
  }

  while (true) {
    let leftCandidate = subdivision.onext(subdivision.sym(base));
    if (valid(leftCandidate, base, subdivision, points)) {
      while (true) {
        const next = subdivision.onext(leftCandidate);
        const check = inCircle(
          point(points, subdivision.dest(base)),
          point(points, subdivision.orig(base)),
          point(points, subdivision.dest(leftCandidate)),
          point(points, subdivision.dest(next)),
        );
        if (check <= EPSILON) break;
        const deleted = leftCandidate;
        leftCandidate = next;
        subdivision.deleteEdge(deleted);
      }
    }

    let rightCandidate = subdivision.oprev(base);
    if (valid(rightCandidate, base, subdivision, points)) {
      while (true) {
        const previous = subdivision.oprev(rightCandidate);
        const check = inCircle(
          point(points, subdivision.dest(base)),
          point(points, subdivision.orig(base)),
          point(points, subdivision.dest(rightCandidate)),
          point(points, subdivision.dest(previous)),
        );
        if (check <= EPSILON) break;
        const deleted = rightCandidate;
        rightCandidate = previous;
        subdivision.deleteEdge(deleted);
      }
    }

    const leftValid = valid(leftCandidate, base, subdivision, points);
    const rightValid = valid(rightCandidate, base, subdivision, points);
    if (!leftValid && !rightValid) break;

    const useRight =
      !leftValid ||
      (rightValid &&
        inCircle(
          point(points, subdivision.dest(leftCandidate)),
          point(points, subdivision.orig(leftCandidate)),
          point(points, subdivision.orig(rightCandidate)),
          point(points, subdivision.dest(rightCandidate)),
        ) > EPSILON);

    base = useRight
      ? subdivision.connect(rightCandidate, subdivision.sym(base))
      : subdivision.connect(subdivision.sym(base), subdivision.sym(leftCandidate));
  }

  return { ldo, rdo };
}

function pointOrder(a: Point | undefined, b: Point | undefined): number {
  if (!a || !b) return 0;
  return a.x - b.x || a.y - b.y;
}

function leftOf(index: number, edge: DirectedEdge, subdivision: QuadEdgeSubdivision, points: readonly Point[]): boolean {
  return orientation(point(points, subdivision.orig(edge)), point(points, subdivision.dest(edge)), point(points, index)) > EPSILON;
}

function rightOf(index: number, edge: DirectedEdge, subdivision: QuadEdgeSubdivision, points: readonly Point[]): boolean {
  return orientation(point(points, subdivision.orig(edge)), point(points, subdivision.dest(edge)), point(points, index)) < -EPSILON;
}

function valid(edge: DirectedEdge, base: DirectedEdge, subdivision: QuadEdgeSubdivision, points: readonly Point[]): boolean {
  if (edge.deleted) return false;
  return rightOf(subdivision.dest(edge), base, subdivision, points);
}

function point(points: readonly Point[], index: number): Point {
  const value = points[index];
  if (!value) throw new Error(`Point ${index} does not exist.`);
  return value;
}
