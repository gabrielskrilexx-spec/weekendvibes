import { createApp } from "../server/_core/app.js";
import type { Request, Response } from "express";

type ExpressApp = ReturnType<typeof createApp>;
let appPromise: Promise<ExpressApp> | null = null;

function loadApp(): Promise<ExpressApp> {
  if (!appPromise) {
    appPromise = Promise.resolve().then(() => createApp());
  }
  return appPromise;
}

function sanitizeStack(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  return error.stack
    ?.replace(/(?:APIFY|META|DATABASE|JWT|OAUTH|BUILT_IN|INTERNAL_CRON)[A-Z0-9_]*=[^\s]+/gi, "$1=[REDACTED]")
    .slice(0, 4000) ?? null;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown serverless initialization error";
    const stackTrace = sanitizeStack(error);
    console.error("[Vercel] Serverless handler initialization failed", {
      message,
      stackTrace,
    });
    res.status(500).json({
      error: "serverless_initialization_failed",
      message: "Serverless API initialization failed",
      stackTrace,
    });
  }
}
