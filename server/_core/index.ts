import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
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
import { ticketingMonitorHandler } from "../scheduled-ticketing-monitor";
import { executiveObservabilityReportHandler } from "../scheduled-executive-report";
import { weeklyExecutiveReportHandler } from "../scheduled-weekly-report";
import { serveStatic } from "./static";
import { applySecurityHeaders, createRateLimit, createStrictCors } from "./security";
import { registerMapsJavascriptRoute } from "../maps-javascript";
import { registerAdminRestRoutes } from "../admin-rest";
import { requireInternalCron, requireVercelCron } from "./cron-auth";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export async function createApp(server?: ReturnType<typeof createServer>) {
  const app = express();
  const httpServer = server ?? createServer(app);
  if (server) server.on("request", app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // OAuth must be registered before content negotiation, security headers,
  // static assets, tRPC, and the SPA fallback so login always reaches GitHub.
  registerOAuthRoutes(app);
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
  registerAdminRestRoutes(app);
  app.get("/api/health", async (_req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const timestamp = new Date().toISOString();
    const db = await getDb();

    if (!db) {
      return res.status(503).json({
        status: "degraded",
        db: "unavailable",
        rateLimiter: "unavailable",
        timestamp,
      });
    }

    try {
      await db.execute(sql`SELECT 1`);
      return res.status(200).json({
        status: "ok",
        db: "connected",
        rateLimiter: "active",
        timestamp,
      });
    } catch (error) {
      console.error("[Health] Database connectivity check failed", error instanceof Error ? error.message : String(error));
      return res.status(503).json({
        status: "degraded",
        db: "unavailable",
        rateLimiter: "unavailable",
        timestamp,
      });
    }
  });
  const noStoreScheduledResponse = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  };
  app.get("/api/scheduled/health", noStoreScheduledResponse, requireVercelCron, (_req, res) => res.json({ ok: true, service: "weekendvibes-api", checkedAt: new Date().toISOString() }));
  app.post("/api/scheduled/health", noStoreScheduledResponse, requireInternalCron, (_req, res) => res.json({ ok: true, service: "weekendvibes-api", checkedAt: new Date().toISOString() }));
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
  app.get("/api/scheduled/ticketing-monitor", noStoreScheduledResponse, requireVercelCron, ticketingMonitorHandler);
  app.get("/api/scheduled/executive-report", noStoreScheduledResponse, requireInternalCron, executiveObservabilityReportHandler);
  app.post("/api/scheduled/weekly-executive-report", noStoreScheduledResponse, requireInternalCron, weeklyExecutiveReportHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    if (!server) throw new Error("Vite development mode requires an HTTP server instance");
    const { setupVite } = await import("./vite");
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  return app;
}

async function startServer() {
  const server = createServer();
  const app = await createApp(server);
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? "undefined"}`);
  }
  server.listen(port, host, () => {
    console.log(`[boot] WeekendVibes listening on ${host}:${port}`, {
      nodeEnv: process.env.NODE_ENV ?? "undefined",
    });
  });
}

if (process.env.VERCEL !== "1") {
  startServer().catch(console.error);
}
