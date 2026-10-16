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

/** Accepts the native Vercel Cron Authorization header without weakening x-cron-secret validation. */
export function hasValidVercelCronSecret(req: Pick<Request, "headers">): boolean {
  if (hasValidInternalCronSecret(req)) return true;
  const configuredSecret = process.env.CRON_SECRET ?? process.env.INTERNAL_CRON_SECRET;
  const authorization = req.headers?.authorization;
  if (!configuredSecret || typeof authorization !== "string" || !/^Bearer\s+/i.test(authorization)) return false;
  const receivedSecret = authorization.replace(/^Bearer\s+/i, "").trim();
  const configuredBytes = Buffer.from(configuredSecret, "utf8");
  const receivedBytes = Buffer.from(receivedSecret, "utf8");
  return configuredBytes.length === receivedBytes.length && timingSafeEqual(configuredBytes, receivedBytes);
}

export function requireVercelCron(req: Request, res: Response, next: NextFunction) {
  if (!hasValidVercelCronSecret(req)) {
    console.warn("[CronAuth] Vercel Cron authentication rejected", { reason: "invalid_or_missing_secret" });
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
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
