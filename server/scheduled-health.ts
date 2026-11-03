import type { Request, Response } from "express";

export function scheduledHealthHandler(_req: Request, res: Response) {
  return res.json({ ok: true, service: "weekendvibes-api", checkedAt: new Date().toISOString() });
}
