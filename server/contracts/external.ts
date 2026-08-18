import { z } from "zod";

const nullableString = z.string().optional().nullable();

export const MetaMediaItemSchema = z.object({
  id: z.string().min(1),
  caption: nullableString,
  timestamp: nullableString,
  permalink: nullableString,
  media_url: nullableString,
  media_type: nullableString,
  username: nullableString,
}).passthrough();

export const MetaBusinessDiscoverySchema = z.object({
  business_discovery: z.object({
    media: z.object({ data: z.array(MetaMediaItemSchema) }).passthrough(),
  }).passthrough(),
}).passthrough();

export const MetaGraphErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
  }).passthrough(),
}).passthrough();

export const RoutesApiRouteSchema = z.object({
  distanceMeters: z.number().nonnegative().optional(),
  duration: z.string().optional(),
  staticDuration: z.string().optional(),
  polyline: z.object({ encodedPolyline: z.string().optional() }).passthrough().optional(),
  localizedValues: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const RoutesApiResponseSchema = z.object({
  routes: z.array(RoutesApiRouteSchema),
}).passthrough();

export const MapsRelayJavascriptSchema = z.string().min(1).refine(source => source.includes("google") || source.includes("maps"), "Relay não retornou JavaScript do Google Maps");

export function parseMetaBusinessDiscovery(value: unknown) { return MetaBusinessDiscoverySchema.parse(value); }
export function parseMetaGraphError(value: unknown) { return MetaGraphErrorSchema.parse(value); }
export function parseRoutesApiResponse(value: unknown) { return RoutesApiResponseSchema.parse(value); }
export function parseMapsRelayJavascript(value: unknown) { return MapsRelayJavascriptSchema.parse(value); }
