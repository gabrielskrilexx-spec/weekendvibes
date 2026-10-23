import { describe, expect, it } from "vitest";
import { fetchWithConcurrency } from "./ingestion";

describe("public fetch resilience", () => {
  it("settles a 502 failure per source and continues processing other sources", async () => {
    const processed: string[] = [];
    const results = await fetchWithConcurrency(["bad-gateway", "healthy-source", "gateway-timeout"], async source => {
      processed.push(source);
      if (source === "bad-gateway") throw new Error("HTTP 502");
      if (source === "gateway-timeout") throw new Error("HTTP 504");
      return "event-from-healthy-source";
    }, 1);

    expect(processed).toEqual(["bad-gateway", "healthy-source", "gateway-timeout"]);
    expect(results[0]).toMatchObject({ status: "rejected" });
    expect(results[1]).toEqual({ status: "fulfilled", value: "event-from-healthy-source" });
    expect(results[2]).toMatchObject({ status: "rejected" });
  });
});
