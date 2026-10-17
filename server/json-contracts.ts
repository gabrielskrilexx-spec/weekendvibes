import { z } from "zod";
import { JsonContractVersion } from "../shared/domain";

const JsonObjectSchema = z.record(z.string(), z.unknown());
const JsonValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), JsonObjectSchema]);

export const IngestionCountsSchema = JsonObjectSchema;
export const IngestionDetailsSchema = JsonObjectSchema;
export const PayloadJsonSchema = JsonValueSchema;

export type IngestionCountsPayload = z.infer<typeof IngestionCountsSchema>;
export type IngestionDetailsPayload = z.infer<typeof IngestionDetailsSchema>;

function withVersion(value: Record<string, unknown>) {
  return { _schemaVersion: JsonContractVersion, ...value };
}

export function serializeIngestionCounts(value: unknown): string {
  const parsed = IngestionCountsSchema.parse(value);
  return JSON.stringify(withVersion(parsed));
}

export function serializeIngestionDetails(value: unknown): string {
  const parsed = IngestionDetailsSchema.parse(value);
  return JSON.stringify(withVersion(parsed));
}

export function serializePayloadJson(value: unknown): string {
  return JSON.stringify({ _schemaVersion: JsonContractVersion, payload: PayloadJsonSchema.parse(value) });
}

export function parseJsonObjectColumn(value: unknown, label: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return IngestionDetailsSchema.parse(parsed ?? {});
}

export function parsePayloadJsonColumn(value: unknown): unknown {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "payload" in parsed) return PayloadJsonSchema.parse((parsed as { payload: unknown }).payload);
  return PayloadJsonSchema.parse(parsed);
}
