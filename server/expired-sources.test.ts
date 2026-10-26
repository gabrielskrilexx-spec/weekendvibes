import { describe, expect, it } from "vitest";
import { isContinuousIngestionSource } from "./db";

describe("expired ingestion source policy", () => {
  it("protects Instagram/Apify profiles", () => {
    expect(isContinuousIngestionSource({ kind: "instagram", sourceKey: "instagram:curvaosurfhouse" })).toBe(true);
  });

  it("protects global ticketing feeds", () => {
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:ingresse" })).toBe(true);
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:zig" })).toBe(true);
  });

  it("allows event-specific public sources to expire", () => {
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:articket-7358" })).toBe(false);
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:zig-inside-001" })).toBe(false);
  });
});
