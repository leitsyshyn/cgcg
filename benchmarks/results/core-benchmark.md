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

- Generated at: 2026-06-08T16:08:38.875Z
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
| 100 | 0.239 | 0.240 | 22 | 284 | 100 | 0.360 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.674 | 0.683 | 36 | 732 | 250 | 0.338 | 2.820 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.527 | 1.532 | 18 | 1478 | 500 | 0.341 | 2.266 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.344 | 3.387 | 8 | 2977 | 1000 | 0.336 | 2.189 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 7.322 | 7.276 | 4 | 5970 | 2000 | 0.334 | 2.190 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 23.283 | 23.028 | 2 | 14973 | 5000 | 0.379 | 3.180 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 53.748 | 52.965 | 1 | 29974 | 10000 | 0.404 | 2.308 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.21x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.212x.
Maximum adjacent-size growth deviation for N >= 500: 13.5%.
Consistency verdict: consistent with practical O(N log N).

### Structured

| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 0.206 | 0.209 | 84 | 286 | 100 | 0.310 | - | - | Validated against brute-force nearest neighbors. |
| 250 | 0.644 | 0.645 | 36 | 730 | 250 | 0.324 | 3.125 | 2.997 | Skipped brute-force validation for N > 100. |
| 500 | 1.430 | 1.434 | 16 | 1480 | 500 | 0.319 | 2.219 | 2.251 | Skipped brute-force validation for N > 100. |
| 1000 | 3.149 | 3.155 | 8 | 2976 | 1000 | 0.316 | 2.202 | 2.223 | Skipped brute-force validation for N > 100. |
| 2000 | 6.905 | 6.955 | 4 | 5972 | 2000 | 0.315 | 2.193 | 2.201 | Skipped brute-force validation for N > 100. |
| 5000 | 19.897 | 19.849 | 2 | 14960 | 5000 | 0.324 | 2.882 | 2.801 | Skipped brute-force validation for N > 100. |
| 10000 | 46.354 | 47.151 | 1 | 29940 | 10000 | 0.349 | 2.330 | 2.163 | Skipped brute-force validation for N > 100. |

Interpretation: For N >= 500, the normalized metric stayed within a 1.11x band and adjacent-size growth stayed close to the N log2 N baseline.
Normalized range factor for N >= 500: 1.108x.
Maximum adjacent-size growth deviation for N >= 500: 7.7%.
Consistency verdict: consistent with practical O(N log N).

## Conclusion

Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.

## Limitations

- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.
- The benchmark measures representative families, not every geometric distribution.
- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.
- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.

