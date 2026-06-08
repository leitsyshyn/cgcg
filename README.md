# All Nearest Neighbors by Delaunay Divide and Conquer

React + TypeScript computational geometry laboratory application for the problem:

> Given a set `S` of `N` points in the Euclidean plane `E2`, find the nearest neighbor for every point.

The implementation follows the proximity-problem terminology from the Tereshchenko lecture materials in `context/`: Voronoi diagram, Delaunay triangulation as the dual graph of the Voronoi diagram, all nearest neighbors, Euclidean distance, and divide-and-conquer construction.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the local Vite URL shown in the terminal.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Benchmark

```bash
npm run benchmark
```

Large-scale supplemental runs for `100000` and `1000000` points use a larger Node heap:

```bash
npm run benchmark:large
```

The benchmark measures the real geometry core only:

- `src/geometry/run-geometry-core.ts`
- `src/geometry/delaunay-triangulation.ts`
- `src/geometry/adjacency-graph.ts`
- `src/geometry/nearest-neighbors.ts`

It runs with trace disabled and excludes dataset generation, brute-force validation, React state updates, and D3/SVG rendering from the timed section.

Benchmark artifacts are written to:

- `benchmarks/results/core-benchmark.json`
- `benchmarks/results/core-benchmark.csv`
- `benchmarks/results/core-benchmark.md`
- `benchmarks/results/core-benchmark-large.json`
- `benchmarks/results/core-benchmark-large.csv`
- `benchmarks/results/core-benchmark-large.md`

The benchmark currently uses two deterministic dataset families across sizes `100` through `10000`:

- `random`: seeded duplicate-free points in a large square;
- `structured`: deterministic staggered lattice with a seam offset for merge stress.

The markdown summary reports both the theoretical `O(N log N)` claim and separate empirical timing evidence, including the normalized metric `T(N) / (N log2 N)`.

## How To Use

1. Pan the plane, then use `Add Points` mode or `Shift`+click to place points manually.
2. Set `Point count` before using the generators.
3. Choose a generation area. `Spread` generates around the plane origin inside a configurable centered range. `Viewport` generates inside the current visible canvas area.
4. Use `Random` for a general demo input.
5. Use `Structured` for a deterministic stress-style lattice input.
6. Use `Upload` to load points from `.txt`, `.csv`, or `.json`.
7. Use `Clear` to remove the current input and trace.
8. Use `Fit View` or `Reset View` to manage the viewport.
9. Press `Run`.
10. Choose `Step`, `Phase`, or `Result` mode.
11. Use `Prev`, `Next`, `Play/Pause`, speed, and step controls to inspect the trace when tracing is available.
12. Toggle labels, Delaunay edges, split lines, candidate edges, circumcircles, deleted edges, and nearest-neighbor arrows.

For `N <= 100`, detailed step tracing is available. For `100 < N <= 2000`, the UI switches to result-oriented phase playback. For `N > 2000`, trace recording is disabled so large runs remain usable while final results and overlays still render.

## Algorithmic Flow

1. Normalize input points and preserve stable point IDs.
2. Reject exact duplicate coordinates and unsupported all-collinear inputs.
3. Sort points by `x`, then `y`, then ID.
4. Recursively divide the sorted set by a median vertical split.
5. Build base Delaunay triangulations for two and three points.
6. Merge triangulations using quad-edge topology:
   - find the lower common tangent;
   - create the base edge;
   - evaluate left and right candidates;
   - use the in-circle predicate to delete invalid edges;
   - connect valid edges until the merge is complete.
7. Extract undirected Delaunay edges from the final topology.
8. Build the Delaunay adjacency graph.
9. For each point, inspect only adjacent Delaunay vertices.
10. Select the minimum squared Euclidean distance and return all tied nearest neighbors.
11. For small inputs, validate nearest-neighbor results against brute force `O(N^2)`.
12. Convert trace events to renderer-ready trace frames.
13. Render the selected trace frame with D3 + SVG.

The intended complexity is `O(N log N)`: sorting plus recursive divide-and-conquer Delaunay construction, followed by linear-size adjacency extraction and nearest-neighbor scanning over Delaunay edges.

## Implementation Boundaries

- Computational geometry core: `src/geometry/*`
- Trace events and projection: `src/trace/*`
- Brute-force validation: `src/validation/*`
- D3/SVG visualization: `src/components/GeometryCanvas.tsx`
- React UI state and controls: `src/App.tsx`

The geometry core does not import React or D3. The renderer consumes `TraceFrame` data and does not inspect mutable algorithm internals.

## Manual Geometry Implementation

The project manually implements:

- squared Euclidean distance;
- orientation predicate;
- in-circle predicate;
- duplicate handling;
- all-collinear rejection;
- quad-edge topology;
- `makeEdge`, `splice`, `connect`, `deleteEdge`;
- symmetric/opposite edge navigation;
- next/previous navigation needed for merge;
- Delaunay divide-and-conquer construction;
- Delaunay adjacency extraction;
- all nearest-neighbor selection with ties.

No `d3-delaunay`, `delaunator`, Voronoi builder, Delaunay library, KD-tree library, or computational geometry solver package is used. D3 is used only for SVG rendering and interaction.

## Trace Modes

- `off`: no trace recording.
- `phase`: major phases only.
- `detailed`: phase events plus smaller semantic steps.

Trace events are UI-neutral and use stable point IDs and edge IDs. The trace projector deterministically replays events into `TraceFrame` objects. It does not run geometry logic.

Examples of emitted events include input normalization, sorting, recursive split, base case, edge creation, edge deletion, splice/connect operations, lower tangent search, candidate selection, orientation check, in-circle check, merge complete, adjacency extraction, nearest-neighbor checks, improvements, ties, final selections, and validation.

## Supported And Unsupported Inputs

Supported:

- two or more distinct finite points;
- general-position non-collinear point sets;
- small exact or near-tie nearest-neighbor situations;
- small cocircular cases may produce one valid Delaunay triangulation among possible alternatives.

Rejected or restricted:

- exact duplicate coordinates;
- fewer than two distinct points;
- all-collinear inputs with more than two points;
- highly degenerate exact configurations can be numerically sensitive because predicates use floating-point arithmetic with an epsilon.

The validation criterion is nearest-neighbor equality against brute force for small inputs, not identical triangulation edge sets.

## Tests

The test suite covers:

- squared distance;
- orientation predicate;
- in-circle predicate;
- duplicate handling;
- brute-force nearest neighbors;
- Delaunay-based nearest-neighbor output on known inputs;
- trace filtering for `off`, `phase`, and `detailed`;
- trace projection basics.

## Notes For Lab Defense

The theoretical justification used by the app is the lecture property that each nearest neighbor of a site shares a Voronoi edge with it. Since the Delaunay triangulation is the dual graph of the Voronoi diagram, nearest-neighbor candidates are adjacent in the Delaunay graph. After building Delaunay triangulation in `O(N log N)`, all nearest neighbors can be found by scanning only Delaunay adjacency rather than all point pairs.

Practical timing evidence is now tracked by the benchmark artifacts under `benchmarks/results/`. Those results are empirical measurements, not a proof of asymptotic complexity.
