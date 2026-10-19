import { describe, expect, it } from "vitest";
import { ApifyRoutineDetailsSchema, ManualIngestionPayloadSchema, parseJsonObjectColumn, parsePayloadJsonColumn, serializeIngestionCounts, serializeIngestionDetails, serializePayloadJson, serializeRoutineDetails, serializeRoutinePayload } from "./json-contracts";

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

  it("uses routine-specific schemas and migrates malformed legacy rows safely", () => {
    const manual = serializeRoutinePayload({ title: "Evento", eventDate: "2026-10-30", locationName: "O Beco", sourceUrl: "https://example.com/evento" }, "manual-ingestion");
    expect(JSON.parse(manual)).toMatchObject({ routine: "manual-ingestion", _schemaVersion: 1 });
    const apify = serializeRoutineDetails({ actorRunId: "run-1", itemsRead: 3 }, "apify-webhook");
    expect(ApifyRoutineDetailsSchema.parse(JSON.parse(apify))).toMatchObject({ actorRunId: "run-1", itemsRead: 3 });
    expect(ManualIngestionPayloadSchema.safeParse({ title: "incompleto" }).success).toBe(false);
    expect(parseJsonObjectColumn("{legacy-invalid", "details")).toMatchObject({ _legacy: true });
    expect(parsePayloadJsonColumn("{legacy-invalid")).toMatchObject({ _legacy: true });
  });
});
