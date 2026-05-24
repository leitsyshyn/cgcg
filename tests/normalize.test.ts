import { describe, expect, it } from 'vitest';
import { normalizeInput } from '../src/geometry/normalize';

describe('input normalization', () => {
  it('rejects duplicate coordinates', () => {
    const result = normalizeInput([
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details?.join(' ')).toContain('Duplicate point');
  });

  it('sorts points by x then y while preserving stable IDs', () => {
    const result = normalizeInput([
      { id: 'b', x: 2, y: 0 },
      { id: 'a', x: 1, y: 3 },
      { id: 'c', x: 1, y: 2 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sortedPoints.map((point) => point.id)).toEqual(['c', 'a', 'b']);
  });
});
