import type { Request, Response } from "express";

const ALLOWED_EVENTS = new Set(["page_view", "pwa_install", "push_enabled", "push_disabled", "offline_enter", "offline_exit"]);
const SAFE_PATH = /^\/[A-Za-z0-9/_~.-]{0,180}$/;

export function webAnalyticsHandler(req: Request, res: Response) {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const event = typeof body.event === "string" ? body.event : "";
  const candidatePath = typeof body.path === "string" ? body.path : "/";
  if (!ALLOWED_EVENTS.has(event) || !SAFE_PATH.test(candidatePath)) {
    return res.status(400).json({ ok: false, error: "INVALID_ANALYTICS_EVENT" });
  }
  // Telemetry is intentionally low-detail: do not record IP, user-agent, cookies, IDs or query strings.
  console.info("[WebAnalytics]", JSON.stringify({ event, path: candidatePath, at: new Date().toISOString() }));
  res.setHeader("Cache-Control", "no-store");
  return res.status(202).json({ ok: true });
}
