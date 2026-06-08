import type { Point } from '../src/geometry/types';

export interface DatasetFamily {
  readonly name: 'random' | 'structured';
  readonly description: string;
  readonly seed: number;
  readonly generate: (count: number) => readonly Point[];
}

const RANDOM_EXTENT = 1_000_000;
const STRUCTURED_SPACING = 72;

export const datasetFamilies: readonly DatasetFamily[] = [
  {
    name: 'random',
    description: 'Seeded duplicate-free integer points spread across a large square.',
    seed: 0x5eed_c0de,
    generate: (count) => generateRandomPoints(count, 0x5eed_c0de),
  },
  {
    name: 'structured',
    description: 'Deterministic staggered lattice with a seam offset to stress recursive merges.',
    seed: 0x51ec7ed,
    generate: generateStructuredStressPoints,
  },
] as const;

function generateRandomPoints(count: number, seed: number): readonly Point[] {
  const next = mulberry32(seed);
  const points: Point[] = [];
  const used = new Set<string>();

  while (points.length < count) {
    const x = Math.round((next() * 2 - 1) * RANDOM_EXTENT);
    const y = Math.round((next() * 2 - 1) * RANDOM_EXTENT);
    const key = `${x}:${y}`;
    if (used.has(key)) continue;
    used.add(key);
    points.push({ x, y });
  }

  return points;
}

function generateStructuredStressPoints(count: number): readonly Point[] {
  const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const seamColumn = Math.floor(columns / 2);
  const xOffset = ((columns - 1) * STRUCTURED_SPACING) / 2;
  const yOffset = ((rows - 1) * STRUCTURED_SPACING) / 2;

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const stagger = row % 2 === 0 ? 0 : STRUCTURED_SPACING / 3;
    const seamShift = column >= seamColumn ? STRUCTURED_SPACING / 6 : 0;
    const waveX = ((row + column * 2) % 5) - 2;
    const waveY = ((column * 3 + row) % 7) - 3;

    return {
      x: Math.round(column * STRUCTURED_SPACING - xOffset + stagger + seamShift + waveX * 3),
      y: Math.round(yOffset - row * STRUCTURED_SPACING + waveY * 4),
    };
  });
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), state | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}
