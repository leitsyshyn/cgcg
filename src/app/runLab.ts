import { adjacencyGraph } from "../geometry/adjacency-graph";
import type { GeometryTrace } from "../geometry/trace";
import {
  delaunayTriangulation,
} from "../geometry/delaunay-triangulation";
import { sortedOrder } from "../geometry/order";
import { nearestNeighbors } from "../geometry/nearest-neighbors";
import { TraceRecorder, type TraceLevel } from "../trace/recorder";
import { validateNearestNeighbors } from "../validation/bruteForceNearest";
import {
  appEdge,
  tracePoint,
  type AlgorithmResult,
  type AppPoint,
  type AppResult,
} from "./types";
import { normalizePoints } from "./normalize";

export function runLab(
  input: readonly AppPoint[],
  traceLevel: TraceLevel,
): AppResult<AlgorithmResult> {
  const start = performance.now();
  const trace = new TraceRecorder(traceLevel);
  const normalized = normalizePoints(input);

  if (!normalized.ok) {
    trace.phase(
      "input-rejected",
      "Input normalization rejected unsupported data.",
      {
        points: input.map(tracePoint),
        ...(normalized.error.details
          ? { details: normalized.error.details }
          : {}),
      },
    );
    return { ok: false, error: normalized.error };
  }

  const points = normalized.value;
  const order = sortedOrder(points);
  const geometryTrace: GeometryTrace | undefined = traceLevel !== "off"
    ? {
        phaseSnapshots: traceLevel === "phase",
        pointId: (index) => points[index]?.id ?? String(index),
        pointLabel: (index) => points[index]?.name ?? `point ${index + 1}`,
        phase: (phase, message, payload) => trace.phase(phase, message, payload),
        detailed: (phase, message, payload) => trace.detailed(phase, message, payload),
      }
    : undefined;

  trace.phase(
    "input-normalized",
    "Input points were normalized with stable app IDs.",
    { points: points.map(tracePoint) },
  );
  trace.phase(
    "points-sorted",
    "Points were sorted by x-coordinate; sorted order receives labels P1..Pn.",
    {
      pointIds: order
        .map((index) => points[index]?.id)
        .filter((id): id is string => Boolean(id)),
    },
  );

  let triangulation;
  try {
    trace.phase(
      "triangulation-start",
      "Started divide-and-conquer Delaunay triangulation.",
      {
        pointIds: points.map((point) => point.id),
      },
    );
    triangulation = delaunayTriangulation(points, geometryTrace);
  } catch (error) {
    return {
      ok: false,
      error: {
        message: "Delaunay construction failed on this input.",
        details: [error instanceof Error ? error.message : String(error)],
      },
    };
  }

  const edges = triangulation.edges.map((edge, index) =>
    appEdge(edge, points, index),
  );
  trace.phase(
    "triangulation-complete",
    "Completed Delaunay triangulation, the dual graph of the Voronoi diagram.",
    {
      edges,
      edgeIds: edges.map((edge) => edge.id),
    },
  );

  const graph = adjacencyGraph(points.length, triangulation.edges);
  trace.phase(
    "adjacency-extracted",
    "Extracted the Delaunay adjacency graph.",
    {
      edges,
      edgeIds: edges.map((edge) => edge.id),
    },
  );

  const nearest = nearestNeighbors(points, graph, geometryTrace);
  const nearestArrows = nearest.flatMap((item) =>
    item.neighbors.map((neighbor) => ({
      from: points[item.point]?.id ?? "",
      to: points[neighbor]?.id ?? "",
    })),
  );
  trace.phase(
    "nearest-neighbor-complete",
    "Completed all nearest-neighbor selections from Delaunay adjacency.",
    {
      nearestArrows,
    },
  );

  const validation = validateNearestNeighbors(points, nearest);
  trace.phase("validation-complete", validation.message, { validation });

  const runtimeMs = performance.now() - start;
  trace.phase("algorithm-complete", "Algorithm completed.", {
    edges,
    nearestArrows,
    runtimeMs,
  });

  return {
    ok: true,
    value: {
      points,
      triangulation,
      edges,
      nearestNeighbors: nearest,
      validation,
      trace: trace.events,
      runtimeMs,
    },
  };
}
