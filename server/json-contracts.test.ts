import { describe, expect, it } from "vitest";
import { parseJsonObjectColumn, parsePayloadJsonColumn, serializeIngestionCounts, serializeIngestionDetails, serializePayloadJson } from "./json-contracts";

describe("json contracts", () => {
  it("versions and preserves ingestion counts", () => {
    const encoded = serializeIngestionCounts({ read: 4, persisted: 2 });
    expect(JSON.parse(encoded)).toMatchObject({ _schemaVersion: 1, read: 4, persisted: 2 });
    expect(parseJsonObjectColumn(encoded, "counts")).toMatchObject({ read: 4, persisted: 2 });
  });

  it("versions details and rejects non-object details", () => {
    const encoded = serializeIngestionDetails({ trigger: "scheduled", retries: 1 });
    expect(parseJsonObjectColumn(encoded, "details")).toMatchObject({ trigger: "scheduled" });
    expect(() => serializeIngestionDetails(["unexpected"])).toThrow();
  });

  it("round-trips payloadJson while keeping a strict envelope", () => {
    const encoded = serializePayloadJson([{ id: "event-1" }]);
    expect(JSON.parse(encoded)).toMatchObject({ _schemaVersion: 1 });
    expect(parsePayloadJsonColumn(encoded)).toEqual([{ id: "event-1" }]);
  });
});
