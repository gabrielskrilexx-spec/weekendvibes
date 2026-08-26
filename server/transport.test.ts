import { describe, expect, it } from "vitest";
import { isoOrNull, normalizeJsonForTransport } from "./transport";

describe("admin transport normalization", () => {
  it("converts complex values into plain JSON-safe values", () => {
    class InternalRecord {
      constructor(readonly id: number) {}
    }

    const normalized = normalizeJsonForTransport({
      createdAt: new Date("2026-08-26T12:00:00.000Z"),
      count: BigInt(3),
      failure: new Error("internal details should be bounded"),
      record: new InternalRecord(7),
      omitted: undefined,
    }) as Record<string, unknown>;

    expect(normalized).toEqual({
      createdAt: "2026-08-26T12:00:00.000Z",
      count: 3,
      failure: { name: "Error", message: "internal details should be bounded" },
      record: { id: 7 },
    });
  });

  it("returns null for invalid or absent date values", () => {
    expect(isoOrNull(new Date("2026-08-26T12:00:00.000Z"))).toBe(
      "2026-08-26T12:00:00.000Z"
    );
    expect(isoOrNull("not-a-date")).toBeNull();
    expect(isoOrNull(undefined)).toBeNull();
  });
});
