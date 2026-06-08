import { describe, expect, it } from 'vitest';
import { parseUploadedPoints } from '../src/app/input';

describe('uploaded input parsing', () => {
  it('preserves decimal coordinates from text rows', () => {
    expect(parseUploadedPoints('1.25 2.5\n-3.75 4.125')).toEqual([
      { x: 1.25, y: 2.5 },
      { x: -3.75, y: 4.125 },
    ]);
  });

  it('accepts label x y rows without altering coordinates', () => {
    expect(parseUploadedPoints('A 0.5 1.75\nB -2.25 9')).toEqual([
      { x: 0.5, y: 1.75 },
      { x: -2.25, y: 9 },
    ]);
  });

  it('preserves decimal coordinates from JSON input', () => {
    expect(parseUploadedPoints('[{"x":1.5,"y":2.25},[-3.125,4.75]]')).toEqual([
      { x: 1.5, y: 2.25 },
      { x: -3.125, y: 4.75 },
    ]);
  });

  it('rejects ambiguous three-number rows', () => {
    expect(() => parseUploadedPoints('1 2 3')).toThrow(/ambiguous/i);
  });

  it('rejects malformed rows instead of dropping them', () => {
    expect(() => parseUploadedPoints('0 0\nbad-row')).toThrow(/Line 2/);
  });

  it('rejects declared point-count mismatches', () => {
    expect(() => parseUploadedPoints('3\n0 0\n1 1')).toThrow(/Declared 3 point rows, but parsed 2/);
  });
});
