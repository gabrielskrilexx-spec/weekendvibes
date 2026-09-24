import type { NextFunction, Request, RequestHandler, Response } from "express";
import { claimRateLimitRequest } from "../db";

const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
]);

export interface RateLimitOptions {
  windowMs: number;
  max: number | ((req: Request) => number);
  name?: string;
}

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const name = options.name ?? "api";

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${req.ip || "unknown"}`;
    const max = typeof options.max === "function" ? options.max(req) : options.max;
    const bucket = await claimRateLimitRequest({ key, windowMs: options.windowMs });
    if (!bucket) {
      next();
      return;
    }
    const resetAt = new Date(bucket.resetAt).getTime();

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.requestCount)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (bucket.requestCount > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt - now) / 1000))));
      res.status(429).json({ error: "too_many_requests" });
      return;
    }

    next();
  };
}

function getAllowedOrigins(): Set<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  return new Set(Array.from(LOCAL_ORIGINS).concat(configured));
}

export function createStrictCors(): RequestHandler {
  const allowedOrigins = getAllowedOrigins();

  return (req, res, next) => {
    const origin = req.headers.origin;
    const forwardedOrigin = getForwardedOrigin(req);
    const isSameSiteOrigin = forwardedOrigin === origin;
    if (typeof origin === "string" && (allowedOrigins.has(origin) || isSameSiteOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      res.setHeader("Vary", "Origin");
    } else if (typeof origin === "string") {
      if (req.method === "OPTIONS") {
        res.status(403).json({ error: "origin_not_allowed" });
        return;
      }
      res.status(403).json({ error: "origin_not_allowed" });
      return;
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function applySecurityHeaders(req: Request, res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
  const analyticsOrigin = getOrigin(process.env.VITE_ANALYTICS_ENDPOINT);
  const mapsProxyOrigin = getOrigin(process.env.VITE_FRONTEND_FORGE_API_URL);
  const connectSources = ["'self'", "https://maps.googleapis.com", "https://maps.gstatic.com"];
  if (analyticsOrigin) connectSources.push(analyticsOrigin);
  if (mapsProxyOrigin) connectSources.push(mapsProxyOrigin);

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' blob: https://maps.googleapis.com https://maps.gstatic.com${mapsProxyOrigin ? ` ${mapsProxyOrigin}` : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSources.join(" ")}`,
  ].join("; ");

  res.setHeader(isProduction ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", policy);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()",);
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (isProduction && isSecure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function getForwardedOrigin(req: Request): string | null {
  const forwardedHost = firstForwardedValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost || (typeof req.headers.host === "string" ? req.headers.host : "");
  if (!host) return null;
  const forwardedProto = firstForwardedValue(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : req.protocol === "http" || req.protocol === "https"
      ? req.protocol
      : null;
  if (!protocol) return null;
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.split(",", 1)[0]?.trim() || null : null;
}

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function redactError(error: unknown): { name: string; code: string } {
  const name = error instanceof Error && error.name ? error.name : "Error";
  return { name: name.slice(0, 80), code: "internal_error" };
}

export function safeErrorResponse(res: Response, status = 500): void {
  res.status(status).json({ error: "internal_error" });
}
