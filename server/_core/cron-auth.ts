import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

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

/** Guard for machine-to-machine callbacks; session cookies are intentionally not accepted. */
export function requireInternalCron(req: Request, res: Response, next: NextFunction) {
  if (!hasValidInternalCronSecret(req)) {
    console.warn("[CronAuth] M2M authentication rejected", { mode: "header", reason: "invalid_or_missing_secret" });
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  console.info("[CronAuth] M2M authentication accepted", { mode: "header" });
  return next();
}
