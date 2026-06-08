import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { datasetFamilies } from './datasets';
import { runGeometryCore } from '../src/geometry/run-geometry-core';
import { validateNearestNeighbors } from '../src/validation/bruteForceNearest';
import type { Point } from '../src/geometry/types';

interface BenchmarkMeasurement {
  readonly family: string;
  readonly size: number;
  readonly batchIterations: number;
  readonly edgeCount: number;
  readonly nearestLinkCount: number;
  readonly samplesMs: readonly number[];
  readonly minMs: number;
  readonly medianMs: number;
  readonly meanMs: number;
  readonly maxMs: number;
  readonly normalizedMsPerNLog2N: number;
  readonly normalizedUsPerNLog2N: number;
  readonly expectedGrowthFromPrevious: number | null;
  readonly observedGrowthFromPrevious: number | null;
  readonly validation: {
    readonly checked: boolean;
    readonly ok: boolean;
    readonly message: string;
  };
}

interface BenchmarkSummary {
  readonly consistentWithONLogN: boolean;
  readonly normalizedRangeFactor: number;
  readonly maxGrowthDeviation: number;
  readonly conclusion: string;
}

interface BenchmarkOutput {
  readonly generatedAt: string;
  readonly nodeVersion: string;
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly workingDirectory: string;
  readonly timedScope: string;
  readonly excludedFromTiming: readonly string[];
  readonly traceLevel: 'off';
  readonly config: {
    readonly sizes: readonly number[];
    readonly warmupRuns: number;
    readonly sampleRuns: number;
    readonly targetSampleMs: number;
    readonly maxBatchIterations: number;
  };
  readonly datasetFamilies: readonly {
    readonly name: string;
    readonly description: string;
    readonly seed: number;
  }[];
  readonly results: readonly BenchmarkMeasurement[];
  readonly summaryByFamily: Readonly<Record<string, BenchmarkSummary>>;
}

const SIZES = [100, 250, 500, 1_000, 2_000, 5_000, 10_000] as const;
const SAMPLE_RUNS = 9;
const WARMUP_RUNS = 2;
const TARGET_SAMPLE_MS = 25;
const MAX_BATCH_ITERATIONS = 128;
const RESULTS_DIR = path.resolve(process.cwd(), 'benchmarks/results');

async function main(): Promise<void> {
  const measurements: BenchmarkMeasurement[] = [];

  for (const family of datasetFamilies) {
    let previous: BenchmarkMeasurement | undefined;
    for (const size of SIZES) {
      const points = family.generate(size);
      const validation = validateDataset(points);
      const warmupBatch = calibrateBatchSize(points);

      for (let run = 0; run < WARMUP_RUNS; run += 1) {
        executeBatch(points, warmupBatch);
      }

      const samplesMs = Array.from({ length: SAMPLE_RUNS }, () => measureBatch(points, warmupBatch));
      const result = executeBatch(points, 1);
      const nLog2N = size * Math.log2(size);
      const medianMs = median(samplesMs);
      const meanMs = average(samplesMs);
      const minMs = Math.min(...samplesMs);
      const maxMs = Math.max(...samplesMs);
      const normalizedMsPerNLog2N = medianMs / nLog2N;
      const normalizedUsPerNLog2N = normalizedMsPerNLog2N * 1_000;
      const expectedGrowthFromPrevious = previous
        ? growthFactor(previous.size, size)
        : null;
      const observedGrowthFromPrevious = previous
        ? medianMs / previous.medianMs
        : null;

      const measurement: BenchmarkMeasurement = {
        family: family.name,
        size,
        batchIterations: warmupBatch,
        edgeCount: result.triangulation.edges.length,
        nearestLinkCount: result.nearestNeighbors.reduce((sum, item) => sum + item.neighbors.length, 0),
        samplesMs,
        minMs,
        medianMs,
        meanMs,
        maxMs,
        normalizedMsPerNLog2N,
        normalizedUsPerNLog2N,
        expectedGrowthFromPrevious,
        observedGrowthFromPrevious,
        validation,
      };
      measurements.push(measurement);
      previous = measurement;
    }
  }

  const summaryByFamily = Object.fromEntries(
    datasetFamilies.map((family) => [family.name, summarizeFamily(measurements.filter((item) => item.family === family.name))]),
  );

  const output: BenchmarkOutput = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    workingDirectory: process.cwd(),
    timedScope: 'runGeometryCore(points) = delaunayTriangulation + adjacencyGraph + nearestNeighbors',
    excludedFromTiming: [
      'dataset generation',
      'trace recording and projection',
      'React and D3 rendering',
      'app result mapping',
      'brute-force validation',
      'file output',
    ],
    traceLevel: 'off',
    config: {
      sizes: SIZES,
      warmupRuns: WARMUP_RUNS,
      sampleRuns: SAMPLE_RUNS,
      targetSampleMs: TARGET_SAMPLE_MS,
      maxBatchIterations: MAX_BATCH_ITERATIONS,
    },
    datasetFamilies: datasetFamilies.map(({ name, description, seed }) => ({ name, description, seed })),
    results: measurements,
    summaryByFamily,
  };

  const json = `${JSON.stringify(output, null, 2)}\n`;
  const csv = toCsv(measurements);
  const markdown = toMarkdown(output);

  await mkdir(RESULTS_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(RESULTS_DIR, 'core-benchmark.json'), json, 'utf8'),
    writeFile(path.join(RESULTS_DIR, 'core-benchmark.csv'), csv, 'utf8'),
    writeFile(path.join(RESULTS_DIR, 'core-benchmark.md'), markdown, 'utf8'),
  ]);

  process.stdout.write(markdown);
}

function validateDataset(points: readonly Point[]): BenchmarkMeasurement['validation'] {
  const result = runGeometryCore(points);
  const validation = validateNearestNeighbors(points, result.nearestNeighbors);
  return {
    checked: validation.checked,
    ok: validation.ok,
    message: validation.message,
  };
}

function calibrateBatchSize(points: readonly Point[]): number {
  const startedAt = performance.now();
  executeBatch(points, 1);
  const elapsedMs = performance.now() - startedAt;

  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return MAX_BATCH_ITERATIONS;
  }

  const target = Math.ceil(TARGET_SAMPLE_MS / elapsedMs);
  return Math.max(1, Math.min(MAX_BATCH_ITERATIONS, target));
}

function measureBatch(points: readonly Point[], batchIterations: number): number {
  const startedAt = performance.now();
  executeBatch(points, batchIterations);
  const elapsedMs = performance.now() - startedAt;
  return elapsedMs / batchIterations;
}

function executeBatch(points: readonly Point[], batchIterations: number) {
  let result = runGeometryCore(points);
  for (let iteration = 1; iteration < batchIterations; iteration += 1) {
    result = runGeometryCore(points);
  }
  return result;
}

function summarizeFamily(measurements: readonly BenchmarkMeasurement[]): BenchmarkSummary {
  const stableWindow = measurements.filter((item) => item.size >= 500);
  const normalizedValues = stableWindow.map((item) => item.normalizedMsPerNLog2N);
  const normalizedMin = Math.min(...normalizedValues);
  const normalizedMax = Math.max(...normalizedValues);
  const normalizedRangeFactor = normalizedMax / normalizedMin;
  const growthDeviations = stableWindow
    .filter((item) => item.expectedGrowthFromPrevious !== null && item.observedGrowthFromPrevious !== null)
    .map((item) => Math.abs((item.observedGrowthFromPrevious ?? 0) / (item.expectedGrowthFromPrevious ?? 1) - 1));
  const maxGrowthDeviation = growthDeviations.length > 0 ? Math.max(...growthDeviations) : 0;
  const consistentWithONLogN = normalizedRangeFactor <= 1.75 && maxGrowthDeviation <= 0.35;
  const conclusion = consistentWithONLogN
    ? `For N >= 500, the normalized metric stayed within a ${formatNumber(normalizedRangeFactor, 2)}x band and adjacent-size growth stayed close to the N log2 N baseline.`
    : `For N >= 500, the normalized metric spread to a ${formatNumber(normalizedRangeFactor, 2)}x band or adjacent-size growth drifted away from the N log2 N baseline.`;

  return {
    consistentWithONLogN,
    normalizedRangeFactor,
    maxGrowthDeviation,
    conclusion,
  };
}

function toCsv(measurements: readonly BenchmarkMeasurement[]): string {
  const rows = [
    [
      'family',
      'size',
      'batchIterations',
      'edgeCount',
      'nearestLinkCount',
      'minMs',
      'medianMs',
      'meanMs',
      'maxMs',
      'normalizedMsPerNLog2N',
      'normalizedUsPerNLog2N',
      'expectedGrowthFromPrevious',
      'observedGrowthFromPrevious',
      'validationChecked',
      'validationOk',
      'validationMessage',
      'samplesMs',
    ].join(','),
  ];

  for (const measurement of measurements) {
    rows.push([
      measurement.family,
      String(measurement.size),
      String(measurement.batchIterations),
      String(measurement.edgeCount),
      String(measurement.nearestLinkCount),
      formatNumber(measurement.minMs, 6),
      formatNumber(measurement.medianMs, 6),
      formatNumber(measurement.meanMs, 6),
      formatNumber(measurement.maxMs, 6),
      formatNumber(measurement.normalizedMsPerNLog2N, 12),
      formatNumber(measurement.normalizedUsPerNLog2N, 9),
      measurement.expectedGrowthFromPrevious === null ? '' : formatNumber(measurement.expectedGrowthFromPrevious, 6),
      measurement.observedGrowthFromPrevious === null ? '' : formatNumber(measurement.observedGrowthFromPrevious, 6),
      String(measurement.validation.checked),
      String(measurement.validation.ok),
      csvCell(measurement.validation.message),
      csvCell(measurement.samplesMs.map((sample) => formatNumber(sample, 6)).join('|')),
    ].join(','));
  }

  return `${rows.join('\n')}\n`;
}

function toMarkdown(output: BenchmarkOutput): string {
  const lines: string[] = [];
  lines.push('# Geometry Core Benchmark Summary');
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push(`- Timed path: \`${output.timedScope}\`.`);
  lines.push(`- Trace level during timing: \`${output.traceLevel}\`.`);
  lines.push('- The benchmark exercises the real geometry core and does not render UI frames.');
  lines.push('- Excluded from timing:');
  for (const item of output.excludedFromTiming) {
    lines.push(`  - ${item}`);
  }
  lines.push('');
  lines.push('## Theoretical Claim');
  lines.push('');
  lines.push('The implementation is intended to run in `O(N log N)`: sorting plus divide-and-conquer Delaunay triangulation, followed by linear-size adjacency extraction and nearest-neighbor scanning over Delaunay edges. This section is a theory statement, not a proof by measurement.');
  lines.push('');
  lines.push('## Empirical Evidence');
  lines.push('');
  lines.push(`- Generated at: ${output.generatedAt}`);
  lines.push(`- Environment: Node ${output.nodeVersion} on ${output.platform} ${output.architecture}`);
  lines.push(`- Sizes: ${output.config.sizes.join(', ')}`);
  lines.push(`- Warmup runs per case: ${output.config.warmupRuns}`);
  lines.push(`- Measured samples per case: ${output.config.sampleRuns}`);
  lines.push(`- Target sample duration before batching: about ${output.config.targetSampleMs} ms`);
  lines.push('');
  lines.push('### Dataset Families');
  lines.push('');
  for (const family of output.datasetFamilies) {
    lines.push(`- \`${family.name}\`: ${family.description} Seed: ${family.seed}.`);
  }

  for (const family of output.datasetFamilies) {
    const rows = output.results.filter((item) => item.family === family.name);
    const summary = output.summaryByFamily[family.name];
    if (!summary) {
      throw new Error(`Missing summary for dataset family ${family.name}.`);
    }
    lines.push('');
    lines.push(`### ${capitalize(family.name)}`);
    lines.push('');
    lines.push('| N | Median ms | Mean ms | Batch | Edges | Nearest links | T(N)/(N log2 N) us | Observed growth | Expected N log2 N growth | Validation |');
    lines.push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const row of rows) {
      lines.push(`| ${row.size} | ${formatNumber(row.medianMs, 3)} | ${formatNumber(row.meanMs, 3)} | ${row.batchIterations} | ${row.edgeCount} | ${row.nearestLinkCount} | ${formatNumber(row.normalizedUsPerNLog2N, 3)} | ${row.observedGrowthFromPrevious === null ? '-' : formatNumber(row.observedGrowthFromPrevious, 3)} | ${row.expectedGrowthFromPrevious === null ? '-' : formatNumber(row.expectedGrowthFromPrevious, 3)} | ${row.validation.ok ? row.validation.message : `FAILED: ${row.validation.message}`} |`);
    }
    lines.push('');
    lines.push(`Interpretation: ${summary.conclusion}`);
    lines.push(`Normalized range factor for N >= 500: ${formatNumber(summary.normalizedRangeFactor, 3)}x.`);
    lines.push(`Maximum adjacent-size growth deviation for N >= 500: ${formatPercent(summary.maxGrowthDeviation)}.`);
    lines.push(`Consistency verdict: ${summary.consistentWithONLogN ? 'consistent with practical O(N log N)' : 'not cleanly consistent with practical O(N log N)'}.`);
  }

  lines.push('');
  lines.push('## Conclusion');
  lines.push('');
  const allConsistent = Object.values(output.summaryByFamily).every((summary) => summary.consistentWithONLogN);
  lines.push(allConsistent
    ? 'Across the tested families, the measured geometry-core timings are consistent with practical `O(N log N)` behavior. This is empirical support, not a proof.'
    : 'The benchmark collected useful timing evidence, but at least one family did not stay cleanly aligned with a practical `O(N log N)` trend on this machine. Treat the data as empirical observation, not proof.');
  lines.push('');
  lines.push('## Limitations');
  lines.push('');
  lines.push('- Wall-clock timings depend on machine load, CPU scaling, and Node runtime behavior.');
  lines.push('- The benchmark measures representative families, not every geometric distribution.');
  lines.push('- The normalized metric is most informative once fixed overhead is small relative to the core work, so the larger N rows matter most.');
  lines.push('- The timed loop excludes trace, brute-force validation, and rendering because the goal is to isolate the geometry core.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function growthFactor(previousSize: number, nextSize: number): number {
  return (nextSize * Math.log2(nextSize)) / (previousSize * Math.log2(previousSize));
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const center = sorted[middle];
  if (center === undefined) {
    throw new Error('Cannot compute median of an empty list.');
  }
  if (sorted.length % 2 === 1) {
    return center;
  }
  const beforeCenter = sorted[middle - 1];
  if (beforeCenter === undefined) {
    throw new Error('Cannot compute median of an empty list.');
  }
  return (beforeCenter + center) / 2;
}

function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
