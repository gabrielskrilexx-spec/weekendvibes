import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { registerStorageProxy } from "./storageProxy.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { ingestEventsHandler, ingestFullAgendaHandler } from "../scheduled.js";
import { ingestAgentDocumentsHandler } from "../scheduled-agent.js";
import { ingestInstagramHandler } from "../scheduled-instagram.js";
import { asyncIngestInstagramHandler, apifyInstagramWebhookHandler, reprocessApifyStoriesDatasetHandler } from "../apify-async.js";
import { heartbeatMonitorHandler } from "../scheduled-heartbeat-monitor.js";
import { exportJobsRecoveryHandler } from "../scheduled-export-recovery.js";
import { applySecurityHeaders, createRateLimit, createStrictCors } from "./security.js";
import { registerMapsJavascriptRoute } from "../maps-javascript.js";
import { registerAdminRestRoutes } from "../admin-rest.js";
import { requireInternalCron } from "./cron-auth.js";
import { recordOperationalAlert } from "../db.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(createStrictCors());
  app.use((req: Request, res: Response, next: NextFunction) => {
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

  const monitorIngestionEndpoint = (req: Request, res: Response, next: NextFunction) => {
    res.once("finish", () => {
      if (res.statusCode < 500) return;
      const path = req.path || req.originalUrl || "unknown";
      const status = res.statusCode;
      void recordOperationalAlert({
        integration: "pipeline",
        alertType: "ingestion_endpoint_failure",
        severity: status >= 500 ? "CRITICAL" : "WARNING",
        title: "Falha no endpoint de ingestão Instagram",
        message: `Endpoint ${path} respondeu HTTP ${status}; revisar o runtime e o deployment da API.`,
        slaMinutes: 30,
      }).catch(error => {
        console.warn("[IngestionMonitor] Could not persist endpoint failure alert", {
          error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error",
        });
      });
    });
    next();
  };

  app.use("/api/scheduled", requirePostForScheduledRoute);
  app.use("/api/v2/ingestion/instagram/async", requirePostForScheduledRoute);

  app.post("/api/scheduled/health", noStoreScheduledResponse, requireInternalCron, (_req: Request, res: Response) => res.json({ ok: true }));
  app.post("/api/scheduled/ingest-events", noStoreScheduledResponse, requireInternalCron, ingestEventsHandler);
  app.post("/api/scheduled/ingest-full-agenda", noStoreScheduledResponse, requireInternalCron, ingestFullAgendaHandler);
  app.post("/api/scheduled/ingest-event-documents", noStoreScheduledResponse, requireInternalCron, ingestAgentDocumentsHandler);
  app.post("/api/scheduled/ingest-instagram", monitorIngestionEndpoint, noStoreScheduledResponse, requireInternalCron, asyncIngestInstagramHandler);
  app.post("/api/v2/ingestion/instagram/async", monitorIngestionEndpoint, noStoreScheduledResponse, requireInternalCron, asyncIngestInstagramHandler);
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
