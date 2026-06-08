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

- Generated at: 2026-06-08T16:39:44.700Z
- Environment: Node v24.13.1 on darwin arm64
- Sizes: 100, 250, 500, 1000, 2000, 5000, 10000
- Warmup runs per case: 2
- Measured samples per case: 9
- Target sample duration before batching: about 25 ms

### Dataset Families

- `random`: Seeded duplicate-free integer points spread across a large square. Seed: 1592639710.
- `structured`: Deterministic staggered stress lattice with a seam offset, used as the worst-case-style large-input efficiency demo. Seed: 85903341.

### Random

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.271 | 0.368 | 33 | 284 | 100 | 0.408 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.856 | 0.891 | 17 | 732 | 250 | 0.430 | 3.157 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 2.000 | 2.195 | 16 | 1478 | 500 | 0.446 | 2.336 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.679 | 5.457 | 5 | 2977 | 1000 | 0.369 | 1.839 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 9.261 | 11.535 | 4 | 5970 | 2000 | 0.422 | 2.517 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 24.265 | 24.086 | 2 | 14973 | 5000 | 0.395 | 2.620 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 51.464 | 52.687 | 1 | 29974 | 10000 | 0.387 | 2.121 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.21x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.209x.
Maximum adjacent-size growth deviation for N >= 500: 17.3%.
Consistency verdict: consistent with practical O(N log N).

### Structured

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.214 | 0.216 | 88 | 286 | 100 | 0.322 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.655 | 0.655 | 39 | 730 | 250 | 0.329 | 3.066 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.503 | 1.686 | 17 | 1480 | 500 | 0.335 | 2.294 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.179 | 3.179 | 8 | 2976 | 1000 | 0.319 | 2.115 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 6.955 | 6.962 | 3 | 5972 | 2000 | 0.317 | 2.188 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 20.974 | 21.491 | 2 | 14960 | 5000 | 0.341 | 3.015 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 46.175 | 46.689 | 1 | 29940 | 10000 | 0.347 | 2.202 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.10x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.096x.
Maximum adjacent-size growth deviation for N >= 500: 7.6%.
Consistency verdict: consistent with practical O(N log N).

## Conclusion

Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.

## Limitations

- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.
- The benchmark measures representative families, not every geometric distribution.
- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.
- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.

