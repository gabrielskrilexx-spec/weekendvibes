import type { Request, Response } from "express";
import { createApp } from "../server/_core/index";

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: Request, res: Response) {
  try {
    appPromise ??= createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error("[vercel] serverless app initialization failed", error);
    if (res.headersSent) return;
    return res.status(500).json({
      error: "SERVER_INITIALIZATION_FAILED",
      message: process.env.NODE_ENV === "production" ? "Falha ao inicializar a API." : error instanceof Error ? error.message : String(error),
    });
  }
}
