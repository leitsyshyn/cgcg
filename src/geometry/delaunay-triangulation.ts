import type { Point, Triangulation } from "./types";
import { circumcircle, insideCircumcircle, orientationSign } from "./predicates";
import { QuadEdgeSubdivision, type DirectedEdge } from "./quad-edge";
import type { GeometryTrace } from "./trace";
import { sortedOrder } from "./order";
import type { TraceTriangle } from "../trace/types";

interface SortedPoint extends Point {
  readonly index: number;
}

interface HullEdges {
  readonly ldo: DirectedEdge;
  readonly rdo: DirectedEdge;
}

export function delaunayTriangulation(points: readonly Point[], trace?: GeometryTrace): Triangulation {
  if (points.length < 2) {
    throw new Error(
      "At least two points are required for Delaunay triangulation.",
    );
  }

  const sortedPoints = sortedOrder(points).map((index) => {
    const value = points[index];
    if (!value) throw new Error(`Point ${index} does not exist.`);
    return { x: value.x, y: value.y, index };
  });
  const subdivision = new QuadEdgeSubdivision(trace);
  divide(sortedPoints, 0, sortedPoints.length, subdivision, points, trace, 0);

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
  trace: GeometryTrace | undefined,
  depth: number,
): HullEdges {
  const count = end - start;
  const subset = sortedPoints.slice(start, end);

  if (count === 2) {
    const a = sortedPoints[start];
    const b = sortedPoints[start + 1];
    if (!a || !b) throw new Error("Invalid two-point base case.");
    trace?.phase("base-case", `Base case with two points: ${trace.pointLabel(a.index)}, ${trace.pointLabel(b.index)}.`, {
      pointIds: [trace.pointId(a.index), trace.pointId(b.index)],
      subsetIds: [trace.pointId(a.index), trace.pointId(b.index)],
    });
    const edge = subdivision.makeEdge(a.index, b.index);
    return { ldo: edge, rdo: subdivision.sym(edge) };
  }

  if (count === 3) {
    const aPoint = sortedPoints[start];
    const bPoint = sortedPoints[start + 1];
    const cPoint = sortedPoints[start + 2];
    if (!aPoint || !bPoint || !cPoint)
      throw new Error("Invalid three-point base case.");
    trace?.phase(
      "base-case",
      `Base case with three points: ${trace.pointLabel(aPoint.index)}, ${trace.pointLabel(bPoint.index)}, ${trace.pointLabel(cPoint.index)}.`,
      {
        pointIds: [trace.pointId(aPoint.index), trace.pointId(bPoint.index), trace.pointId(cPoint.index)],
        subsetIds: [trace.pointId(aPoint.index), trace.pointId(bPoint.index), trace.pointId(cPoint.index)],
      },
    );

    const a = subdivision.makeEdge(aPoint.index, bPoint.index);
    const b = subdivision.makeEdge(bPoint.index, cPoint.index);
    subdivision.splice(subdivision.sym(a), b);

    const orientationResult = orientationSign(aPoint, bPoint, cPoint);
    trace?.detailed("orientation-check", "Checked orientation for three-point base case.", {
      pointIds: [trace.pointId(aPoint.index), trace.pointId(bPoint.index), trace.pointId(cPoint.index)],
      value: orientationResult,
      activeTriangle: traceTriangle(aPoint.index, bPoint.index, cPoint.index, trace),
    });
    if (orientationResult > 0) {
      const c = subdivision.connect(b, a);
      trace?.detailed("active-triangle", "Created counter-clockwise base triangle.", {
        activeTriangle: traceTriangle(aPoint.index, bPoint.index, cPoint.index, trace),
        edgeIds: [subdivision.edgeId(a), subdivision.edgeId(b), subdivision.edgeId(c)],
      });
      return { ldo: a, rdo: subdivision.sym(b) };
    }

    if (orientationResult < 0) {
      const c = subdivision.connect(b, a);
      trace?.detailed("active-triangle", "Created clockwise base triangle and returned hull edges accordingly.", {
        activeTriangle: traceTriangle(aPoint.index, cPoint.index, bPoint.index, trace),
        edgeIds: [subdivision.edgeId(a), subdivision.edgeId(b), subdivision.edgeId(c)],
      });
      return { ldo: subdivision.sym(c), rdo: c };
    }

    return { ldo: a, rdo: subdivision.sym(b) };
  }

  const middle = start + Math.floor(count / 2);
  const leftSubset = sortedPoints.slice(start, middle);
  const rightSubset = sortedPoints.slice(middle, end);
  const beforeSplit = sortedPoints[middle - 1];
  const afterSplit = sortedPoints[middle];
  if (!beforeSplit || !afterSplit) throw new Error("Invalid recursive split.");
  const splitX = (beforeSplit.x + afterSplit.x) / 2;
  trace?.phase("recursive-split", "Split point set by median x-coordinate.", {
    pointIds: subsetIds(subset, trace),
    subsetIds: subsetIds(subset, trace),
    leftIds: subsetIds(leftSubset, trace),
    rightIds: subsetIds(rightSubset, trace),
    splitX,
    depth,
  });

  const left = divide(sortedPoints, start, middle, subdivision, points, trace, depth + 1);
  const right = divide(sortedPoints, middle, end, subdivision, points, trace, depth + 1);
  return merge(left, right, subdivision, points, trace, subset, splitX);
}

function merge(
  left: HullEdges,
  right: HullEdges,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
  trace: GeometryTrace | undefined,
  subset: readonly SortedPoint[],
  splitX: number,
): HullEdges {
  let ldi = left.rdo;
  let rdi = right.ldo;

  trace?.phase("merge-start", "Started merge: find lower common tangent, then stitch the two Delaunay triangulations.", {
    subsetIds: subsetIds(subset, trace),
    splitX,
    edgeIds: [subdivision.edgeId(ldi), subdivision.edgeId(rdi)],
  });

  while (true) {
    trace?.detailed("lower-tangent-search", "Testing current lower tangent candidates.", {
      edgeIds: [subdivision.edgeId(ldi), subdivision.edgeId(rdi)],
      activeBaseEdge: [tracePointId(subdivision.orig(ldi), trace), tracePointId(subdivision.orig(rdi), trace)],
    });

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

  trace?.phase("lower-tangent-found", "Found the lower common tangent.", {
    activeBaseEdge: [tracePointId(subdivision.orig(ldi), trace), tracePointId(subdivision.orig(rdi), trace)],
    edgeIds: [subdivision.edgeId(ldi), subdivision.edgeId(rdi)],
  });

  let base = subdivision.connect(subdivision.sym(rdi), ldi);
  trace?.phase("base-edge-created", "Inserted the initial base edge across the split.", {
    edgeIds: [subdivision.edgeId(base)],
    activeBaseEdge: subdivision.edgePointPair(base),
  });
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
        const violatesDelaunay = insideCircumcircle(
          point(points, subdivision.dest(base)),
          point(points, subdivision.orig(base)),
          point(points, subdivision.dest(leftCandidate)),
          point(points, subdivision.dest(next)),
        );
        trace?.detailed("in-circle-check", "Checked whether the next left candidate violates the Delaunay empty-circle condition.", {
          edgeIds: [subdivision.edgeId(base), subdivision.edgeId(leftCandidate), subdivision.edgeId(next)],
          pointIds: [
            tracePointId(subdivision.dest(base), trace),
            tracePointId(subdivision.orig(base), trace),
            tracePointId(subdivision.dest(leftCandidate), trace),
            tracePointId(subdivision.dest(next), trace),
          ],
          activeTriangle: traceTriangle(subdivision.dest(base), subdivision.orig(base), subdivision.dest(leftCandidate), trace),
          testedPoint: tracePointId(subdivision.dest(next), trace),
          circumcircle: circumcircle(
            point(points, subdivision.dest(base)),
            point(points, subdivision.orig(base)),
            point(points, subdivision.dest(leftCandidate)),
          ),
          value: Number(violatesDelaunay),
        });
        if (!violatesDelaunay) break;
        const deleted = leftCandidate;
        leftCandidate = next;
        subdivision.deleteEdge(deleted);
      }
    }

    let rightCandidate = subdivision.oprev(base);
    if (valid(rightCandidate, base, subdivision, points)) {
      while (true) {
        const previous = subdivision.oprev(rightCandidate);
        const violatesDelaunay = insideCircumcircle(
          point(points, subdivision.dest(base)),
          point(points, subdivision.orig(base)),
          point(points, subdivision.dest(rightCandidate)),
          point(points, subdivision.dest(previous)),
        );
        trace?.detailed("in-circle-check", "Checked whether the next right candidate violates the Delaunay empty-circle condition.", {
          edgeIds: [subdivision.edgeId(base), subdivision.edgeId(rightCandidate), subdivision.edgeId(previous)],
          pointIds: [
            tracePointId(subdivision.dest(base), trace),
            tracePointId(subdivision.orig(base), trace),
            tracePointId(subdivision.dest(rightCandidate), trace),
            tracePointId(subdivision.dest(previous), trace),
          ],
          activeTriangle: traceTriangle(subdivision.dest(base), subdivision.orig(base), subdivision.dest(rightCandidate), trace),
          testedPoint: tracePointId(subdivision.dest(previous), trace),
          circumcircle: circumcircle(
            point(points, subdivision.dest(base)),
            point(points, subdivision.orig(base)),
            point(points, subdivision.dest(rightCandidate)),
          ),
          value: Number(violatesDelaunay),
        });
        if (!violatesDelaunay) break;
        const deleted = rightCandidate;
        rightCandidate = previous;
        subdivision.deleteEdge(deleted);
      }
    }

    const leftValid = valid(leftCandidate, base, subdivision, points);
    const rightValid = valid(rightCandidate, base, subdivision, points);
    trace?.detailed("candidate-selection", "Selected valid left and right merge candidates.", {
      edgeIds: [subdivision.edgeId(base), subdivision.edgeId(leftCandidate), subdivision.edgeId(rightCandidate)],
      leftCandidate: leftValid ? subdivision.edgePointPair(leftCandidate) : null,
      rightCandidate: rightValid ? subdivision.edgePointPair(rightCandidate) : null,
      activeBaseEdge: subdivision.edgePointPair(base),
    });
    if (!leftValid && !rightValid) break;

    const useRight =
      !leftValid ||
      (rightValid &&
        insideCircumcircle(
          point(points, subdivision.dest(leftCandidate)),
          point(points, subdivision.orig(leftCandidate)),
          point(points, subdivision.orig(rightCandidate)),
          point(points, subdivision.dest(rightCandidate)),
        ));

    base = useRight
      ? subdivision.connect(rightCandidate, subdivision.sym(base))
      : subdivision.connect(
          subdivision.sym(base),
          subdivision.sym(leftCandidate),
        );
    trace?.detailed("base-edge-created", "Advanced the merge chain with a new base edge.", {
      edgeIds: [subdivision.edgeId(base)],
      activeBaseEdge: subdivision.edgePointPair(base),
    });
  }

  trace?.phase("merge-complete", "Completed merge of the two recursively built triangulations.", {
    subsetIds: subsetIds(subset, trace),
  });

  return { ldo, rdo };
}

function leftOf(
  index: number,
  edge: DirectedEdge,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
): boolean {
  return (
    orientationSign(
      point(points, subdivision.orig(edge)),
      point(points, subdivision.dest(edge)),
      point(points, index),
    ) > 0
  );
}

function rightOf(
  index: number,
  edge: DirectedEdge,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
): boolean {
  return (
    orientationSign(
      point(points, subdivision.orig(edge)),
      point(points, subdivision.dest(edge)),
      point(points, index),
    ) < 0
  );
}

function valid(
  edge: DirectedEdge,
  base: DirectedEdge,
  subdivision: QuadEdgeSubdivision,
  points: readonly Point[],
): boolean {
  if (edge.deleted) return false;
  return rightOf(subdivision.dest(edge), base, subdivision, points);
}

function point(points: readonly Point[], index: number): Point {
  const value = points[index];
  if (!value) throw new Error(`Point ${index} does not exist.`);
  return value;
}

function subsetIds(points: readonly SortedPoint[], trace: GeometryTrace | undefined): readonly string[] {
  return points.map((item) => tracePointId(item.index, trace));
}

function tracePointId(index: number, trace: GeometryTrace | undefined): string {
  return trace?.pointId(index) ?? String(index);
}

function traceTriangle(a: number, b: number, c: number, trace: GeometryTrace | undefined): TraceTriangle {
  return {
    a: tracePointId(a, trace),
    b: tracePointId(b, trace),
    c: tracePointId(c, trace),
  };
}
