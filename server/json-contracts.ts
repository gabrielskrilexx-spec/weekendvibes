import { z } from "zod";
import { JsonContractVersion } from "../shared/domain";

const JsonValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.string(), z.unknown())]);
export const IngestionCountsSchema = z.object({ _schemaVersion: z.number().int().positive().optional(), read: z.number().nonnegative().optional(), filtered: z.number().nonnegative().optional(), persisted: z.number().nonnegative().optional(), approved: z.number().nonnegative().optional(), structured: z.number().nonnegative().optional(), rejectedEvents: z.number().nonnegative().optional(), rejectedPastEvents: z.number().nonnegative().optional(), rejectedOtherReasons: z.number().nonnegative().optional() }).catchall(z.unknown());
export const IngestionDetailsSchema = z.object({ _schemaVersion: z.number().int().positive().optional() }).catchall(z.unknown());
export const ManualIngestionPayloadSchema = z.object({ title: z.string().min(1), eventDate: z.string().min(1), locationName: z.string().min(1), sourceUrl: z.string().url() }).passthrough();
export const ApifyRoutineDetailsSchema = z.object({ _schemaVersion: z.number().int().positive().optional(), actorRunId: z.string().optional(), datasetId: z.string().optional(), itemsRead: z.number().nonnegative().optional(), batches: z.number().nonnegative().optional() }).catchall(z.unknown());
export const PayloadJsonSchema = JsonValueSchema;
export type IngestionCountsPayload = z.infer<typeof IngestionCountsSchema>;
export type IngestionDetailsPayload = z.infer<typeof IngestionDetailsSchema>;

function withVersion(value: Record<string, unknown>) { return { _schemaVersion: JsonContractVersion, ...value }; }
export function serializeIngestionCounts(value: unknown): string { return JSON.stringify(withVersion(IngestionCountsSchema.parse(value))); }
export function serializeIngestionDetails(value: unknown): string { return JSON.stringify(withVersion(IngestionDetailsSchema.parse(value))); }
export function serializeRoutineDetails(value: unknown, routine: string): string { const parsed = /apify/i.test(routine) ? ApifyRoutineDetailsSchema.parse(value) : IngestionDetailsSchema.parse(value); return JSON.stringify(withVersion(parsed)); }
export function serializeRoutinePayload(value: unknown, routine: string): string { const parsed = /manual/i.test(routine) ? ManualIngestionPayloadSchema.parse(value) : PayloadJsonSchema.parse(value); return JSON.stringify({ _schemaVersion: JsonContractVersion, routine, payload: parsed }); }
export function serializePayloadJson(value: unknown): string { return JSON.stringify({ _schemaVersion: JsonContractVersion, payload: PayloadJsonSchema.parse(value) }); }

export function parseJsonObjectColumn(value: unknown, label: string): Record<string, unknown> {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return IngestionDetailsSchema.parse(parsed ?? {}); }
  catch { return { _schemaVersion: JsonContractVersion, _legacy: true, _legacyLabel: label, value: typeof value === "string" ? value.slice(0, 20000) : null }; }
}
export function parsePayloadJsonColumn(value: unknown): unknown {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "payload" in parsed) return PayloadJsonSchema.parse((parsed as { payload: unknown }).payload); return PayloadJsonSchema.parse(parsed); }
  catch { return { _schemaVersion: JsonContractVersion, _legacy: true, payload: null }; }
}
export function sanitizeRoutineDetails(value: unknown, routine: string): Record<string, unknown> { const parsed = parseJsonObjectColumn(value, routine); return /apify/i.test(routine) ? ApifyRoutineDetailsSchema.parse(parsed) : IngestionDetailsSchema.parse(parsed); }
