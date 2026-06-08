# Geometry Core Benchmark Summary

## Scope

- Timed path: `runGeometryCore(points) = delaunayTriangulation + adjacencyGraph + nearestNeighbors`.
- Trace level during timing: `off`.
- The benchmark exercises the real geometry core and does not render UI frames.
- Excluded from timing:
  - dataset generation
  - trace recording and projection
  - React and D3 rendering
  - app result mapping
  - brute-force validation
  - file output

## Theoretical Claim

The implementation is intended to run in `O(N log N)`: sorting plus divide-and-conquer Delaunay triangulation, followed by linear-size adjacency extraction and nearest-neighbor scanning over Delaunay edges. This section is a theory statement, not a proof by measurement.

## Empirical Evidence

- Generated at: 2026-06-08T16:19:26.676Z
- Environment: Node v24.13.1 on darwin arm64
- Sizes: 100000, 1000000
- Warmup runs per case: 1
- Measured samples per case: 2
- Target sample duration before batching: about 1 ms

### Dataset Families

- `random`: Seeded duplicate-free integer points spread across a large square. Seed: 1592639710.
- `structured`: Deterministic staggered lattice with a seam offset to stress recursive merges. Seed: 85903341.

### Random

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100000 | 780.794 | 780.794 | 1 | 299965 | 100000 | 0.470 | - | - | Skipped brute-force validation for N > 100. |
| 1000000 | 12371.863 | 12371.863 | 1 | 2999953 | 1000002 | 0.621 | 15.845 | 12.000 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.32x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.320x.
Maximum adjacent-size growth deviation for N >= 500: 32.0%.
Consistency verdict: consistent with practical O(N log N).

### Structured

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100000 | 525.561 | 525.561 | 1 | 299857 | 100000 | 0.316 | - | - | Skipped brute-force validation for N > 100. |
| 1000000 | 7926.911 | 7926.911 | 1 | 2999502 | 1000000 | 0.398 | 15.083 | 12.000 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.26x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.257x.
Maximum adjacent-size growth deviation for N >= 500: 25.7%.
Consistency verdict: consistent with practical O(N log N).

## Conclusion

Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.

## Limitations

- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.
- The benchmark measures representative families, not every geometric distribution.
- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.
- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.

