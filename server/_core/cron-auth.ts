import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const CRON_SECRET_HEADER = "x-cron-secret";

export function hasValidInternalCronSecret(req: Pick<Request, "headers">): boolean {
  const configuredSecret = process.env.INTERNAL_CRON_SECRET;
  const receivedSecret = req.headers?.[CRON_SECRET_HEADER];
  if (!configuredSecret || typeof receivedSecret !== "string" || receivedSecret.length === 0) return false;

  const configuredBytes = Buffer.from(configuredSecret, "utf8");
  const receivedBytes = Buffer.from(receivedSecret, "utf8");
  if (configuredBytes.length !== receivedBytes.length) return false;
  return timingSafeEqual(configuredBytes, receivedBytes);
}

export function cronAuthMode(req: Pick<Request, "headers">): "machine" | "session" {
  return hasValidInternalCronSecret(req) ? "machine" : "session";
}

export const cronSecretHeaderName = CRON_SECRET_HEADER;
