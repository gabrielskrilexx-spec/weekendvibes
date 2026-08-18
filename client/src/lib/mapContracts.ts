import { z } from "zod";

export const RoutesApiResponseSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().nonnegative().optional(),
    duration: z.string().optional(),
    staticDuration: z.string().optional(),
    polyline: z.object({ encodedPolyline: z.string().optional() }).passthrough().optional(),
  }).passthrough()),
}).passthrough();

export const MapsRelayJavascriptSchema = z.string().min(1).refine(value => /google\.maps|maps\./i.test(value), "Relay não retornou JavaScript do Google Maps");

export function parseRoutesApiResponse(value: unknown) { return RoutesApiResponseSchema.parse(value); }
export function parseMapsRelayJavascript(value: unknown) { return MapsRelayJavascriptSchema.parse(value); }
