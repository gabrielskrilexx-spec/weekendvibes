import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ingestEventsHandler, ingestFullAgendaHandler } from "../scheduled";
import { ingestAgentDocumentsHandler } from "../scheduled-agent";
import { ingestInstagramHandler } from "../scheduled-instagram";
import { asyncIngestInstagramHandler, apifyInstagramWebhookHandler, reprocessApifyStoriesDatasetHandler } from "../apify-async";
import { heartbeatMonitorHandler } from "../scheduled-heartbeat-monitor";
import { exportJobsRecoveryHandler } from "../scheduled-export-recovery";
import { applySecurityHeaders, createRateLimit, createStrictCors } from "./security";
import { registerMapsJavascriptRoute } from "../maps-javascript";
import { registerAdminRestRoutes } from "../admin-rest";
import { requireInternalCron } from "./cron-auth";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(createStrictCors());
  app.use((req, res, next) => {
    applySecurityHeaders(req, res);
    next();
  });
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use("/api/oauth", createRateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: "oauth" }));
  app.use("/api/trpc", createRateLimit({
    windowMs: 60 * 1000,
    name: "trpc",
    max: req => /(?:adminRoutine|ingestionReports|circuitBreaker|operationalAlerts)/i.test(String(req.query.path ?? "")) ? 60 : 120,
  }));
  app.use("/manus-storage", createRateLimit({ windowMs: 60 * 1000, max: 120, name: "storage" }));
  registerStorageProxy(app);
  app.use("/api/maps", createRateLimit({ windowMs: 60 * 1000, max: 30, name: "maps-script" }));
  registerMapsJavascriptRoute(app);
  registerOAuthRoutes(app);
  registerAdminRestRoutes(app);

  const noStoreScheduledResponse = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };

  const requirePostForScheduledRoute = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") {
      res.status(405).setHeader("Allow", "POST").json({
        error: "method_not_allowed",
        allowedMethods: ["POST"],
      });
      return;
    }
    next();
  };

  app.use("/api/scheduled", requirePostForScheduledRoute);
  app.use("/api/v2/ingestion/instagram/async", requirePostForScheduledRoute);

  app.post("/api/scheduled/health", noStoreScheduledResponse, requireInternalCron, (_req, res) => res.json({ ok: true }));
  app.post("/api/scheduled/ingest-events", noStoreScheduledResponse, requireInternalCron, ingestEventsHandler);
  app.post("/api/scheduled/ingest-full-agenda", noStoreScheduledResponse, requireInternalCron, ingestFullAgendaHandler);
  app.post("/api/scheduled/ingest-event-documents", noStoreScheduledResponse, requireInternalCron, ingestAgentDocumentsHandler);
  app.post("/api/scheduled/ingest-instagram", noStoreScheduledResponse, requireInternalCron, asyncIngestInstagramHandler);
  app.post("/api/v2/ingestion/instagram/async", noStoreScheduledResponse, requireInternalCron, asyncIngestInstagramHandler);
  app.post("/api/scheduled/ingest-instagram-sync", noStoreScheduledResponse, requireInternalCron, ingestInstagramHandler);
  app.post("/api/webhooks/apify/instagram", noStoreScheduledResponse, apifyInstagramWebhookHandler);
  app.post("/api/v2/ingestion/instagram/reprocess-dataset", noStoreScheduledResponse, reprocessApifyStoriesDatasetHandler);
  app.post("/api/scheduled/monitor-heartbeat", noStoreScheduledResponse, requireInternalCron, heartbeatMonitorHandler);
  app.post("/api/scheduled/export-jobs-recovery", noStoreScheduledResponse, requireInternalCron, exportJobsRecoveryHandler);

  app.use("/api/trpc", createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  return app;
}
