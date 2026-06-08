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

- Generated at: 2026-06-08T18:59:56.563Z
- Environment: Node v24.13.1 on darwin arm64
- Sizes: 100, 250, 500, 1000, 2000, 5000, 10000
- Warmup runs per case: 2
- Measured samples per case: 9
- Target sample duration before batching: about 25 ms

### Dataset Families

- `random`: Seeded duplicate-free integer points spread across a large square. Seed: 1592639710.
- `structured`: Deterministic staggered stress lattice with a seam offset, used as the worst-case-style large-input efficiency demo. Seed: 85903341.
- `circle-high-degree`: One center point plus a slightly perturbed outer ring, stressing a high-degree Delaunay neighborhood without exact cocircular degeneracy. Seed: 793630.

### Random

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.234 | 0.235 | 30 | 284 | 100 | 0.352 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.676 | 0.693 | 28 | 732 | 250 | 0.339 | 2.895 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.571 | 1.568 | 13 | 1478 | 500 | 0.350 | 2.324 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.277 | 3.283 | 8 | 2977 | 1000 | 0.329 | 2.086 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 7.378 | 7.543 | 4 | 5970 | 2000 | 0.336 | 2.251 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 23.758 | 24.252 | 2 | 14973 | 5000 | 0.387 | 3.220 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 51.416 | 51.892 | 1 | 29974 | 10000 | 0.387 | 2.164 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.18x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.177x.
Maximum adjacent-size growth deviation for N >= 500: 15.0%.
Consistency verdict: consistent with practical O(N log N).

### Structured

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.206 | 0.210 | 79 | 286 | 100 | 0.310 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.640 | 0.641 | 36 | 730 | 250 | 0.321 | 3.107 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.444 | 1.434 | 17 | 1480 | 500 | 0.322 | 2.256 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.213 | 3.186 | 9 | 2976 | 1000 | 0.322 | 2.226 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 6.790 | 6.811 | 4 | 5972 | 2000 | 0.310 | 2.113 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 20.665 | 20.628 | 2 | 14960 | 5000 | 0.336 | 3.043 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 45.805 | 46.826 | 1 | 29940 | 10000 | 0.345 | 2.217 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.11x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.113x.
Maximum adjacent-size growth deviation for N >= 500: 8.6%.
Consistency verdict: consistent with practical O(N log N).

### Circle-high-degree

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.170 | 0.180 | 71 | 198 | 100 | 0.256 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.508 | 0.507 | 49 | 498 | 250 | 0.255 | 2.980 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.127 | 1.123 | 23 | 998 | 500 | 0.251 | 2.221 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 2.484 | 2.483 | 10 | 1998 | 1000 | 0.249 | 2.204 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 5.464 | 5.432 | 5 | 3998 | 2000 | 0.249 | 2.199 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 16.840 | 16.634 | 2 | 9998 | 5000 | 0.274 | 3.082 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 41.266 | 41.459 | 1 | 19998 | 10000 | 0.311 | 2.450 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.25x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.247x.
Maximum adjacent-size growth deviation for N >= 500: 13.3%.
Consistency verdict: consistent with practical O(N log N).

## Conclusion

Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.

## Limitations

- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.
- The benchmark measures representative families, not every geometric distribution.
- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.
- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.

