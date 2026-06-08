import { describe, expect, it } from "vitest";
import { normalizePoints } from "../src/app/normalize";
import { sortedOrder } from "../src/geometry/order";

describe("input normalization", () => {
  it("rejects duplicate coordinates", () => {
    const result = normalizePoints([
      { id: "a", name: "A", x: 1, y: 1, sortedIndex: null },
      { id: "b", name: "B", x: 1, y: 1, sortedIndex: null },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.details?.join(" ")).toContain("duplicates");
  });

  it("accepts all-collinear inputs that can be handled downstream", () => {
    const result = normalizePoints([
      { id: "a", name: "A", x: 0, y: 0, sortedIndex: null },
      { id: "b", name: "B", x: 0, y: 3, sortedIndex: null },
      { id: "c", name: "C", x: 0, y: 8, sortedIndex: null },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((point) => point.sortedIndex)).toEqual([0, 1, 2]);
    }
  });

  it("rejects non-finite coordinates", () => {
    const result = normalizePoints([
      { id: "a", name: "A", x: Number.NaN, y: 0, sortedIndex: null },
      { id: "b", name: "B", x: 1, y: Number.POSITIVE_INFINITY, sortedIndex: null },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toEqual([
        "A has non-finite coordinates.",
        "B has non-finite coordinates.",
      ]);
    }
  });

  it("uses fallback point labels in duplicate diagnostics", () => {
    const result = normalizePoints([
      { id: "a", name: "", x: 2, y: 2, sortedIndex: null },
      { id: "b", name: "", x: 2, y: 2, sortedIndex: null },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toContain(
        "Duplicate coordinates are unsupported: point 2 duplicates point 1 at (2, 2).",
      );
    }
  });

  it("requires at least two distinct points", () => {
    const result = normalizePoints([
      { id: "a", name: "A", x: 1, y: 1, sortedIndex: null },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toContain("At least two distinct points are required.");
    }
  });

  it("sorts point indices by x then y", () => {
    expect(
      sortedOrder([
        { x: 2, y: 0 },
        { x: 1, y: 3 },
        { x: 1, y: 2 },
      ]),
    ).toEqual([2, 1, 0]);
  });
});
