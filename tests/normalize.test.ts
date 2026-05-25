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
