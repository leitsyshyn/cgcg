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

## How To Use

1. Click inside the working area to manually add points.
2. Use `Random small set` for a small demonstration input.
3. Use `Structured grid` for a regular test input.
4. Use `Clear/reset` to remove the current input and trace.
5. Press `Run algorithm`.
6. Choose `Step mode`, `Phase mode`, or `Result-only mode`.
7. Use `Prev`, `Next`, `Play/Pause`, speed, and step controls to inspect the trace.
8. Toggle labels, Delaunay edges, split lines, candidate edges, circumcircles, deleted edges, and nearest-neighbor arrows.

For `N <= 100`, detailed step tracing is available. For `N > 100`, detailed tracing is disabled and the UI switches to result-oriented phase playback.

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

There is intentionally no benchmark screen, benchmark chart, benchmark report, benchmark table, or performance experiment in this project.
