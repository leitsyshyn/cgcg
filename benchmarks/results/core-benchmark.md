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

- Generated at: 2026-06-08T16:17:05.114Z
- Environment: Node v24.13.1 on darwin arm64
- Sizes: 100, 250, 500, 1000, 2000, 5000, 10000
- Warmup runs per case: 2
- Measured samples per case: 9
- Target sample duration before batching: about 25 ms

### Dataset Families

- `random`: Seeded duplicate-free integer points spread across a large square. Seed: 1592639710.
- `structured`: Deterministic staggered lattice with a seam offset to stress recursive merges. Seed: 85903341.

### Random

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.237 | 0.237 | 32 | 284 | 100 | 0.357 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.679 | 0.690 | 33 | 732 | 250 | 0.341 | 2.867 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.494 | 1.519 | 18 | 1478 | 500 | 0.333 | 2.200 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.289 | 3.366 | 8 | 2977 | 1000 | 0.330 | 2.201 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 7.256 | 7.253 | 4 | 5970 | 2000 | 0.331 | 2.206 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 23.951 | 23.966 | 2 | 14973 | 5000 | 0.390 | 3.301 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 51.079 | 51.147 | 1 | 29974 | 10000 | 0.384 | 2.133 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.18x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.181x.
Maximum adjacent-size growth deviation for N >= 500: 17.8%.
Consistency verdict: consistent with practical O(N log N).

### Structured

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.206 | 0.206 | 87 | 286 | 100 | 0.311 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.647 | 0.686 | 37 | 730 | 250 | 0.325 | 3.135 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.435 | 1.435 | 17 | 1480 | 500 | 0.320 | 2.218 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.178 | 3.180 | 8 | 2976 | 1000 | 0.319 | 2.215 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 6.831 | 6.829 | 4 | 5972 | 2000 | 0.311 | 2.149 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 21.054 | 20.696 | 2 | 14960 | 5000 | 0.343 | 3.082 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 45.955 | 46.546 | 1 | 29940 | 10000 | 0.346 | 2.183 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.11x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.110x.
Maximum adjacent-size growth deviation for N >= 500: 10.0%.
Consistency verdict: consistent with practical O(N log N).

## Conclusion

Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.

## Limitations

- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.
- The benchmark measures representative families, not every geometric distribution.
- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.
- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.

