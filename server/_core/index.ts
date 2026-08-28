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
import { asyncIngestInstagramHandler, apifyInstagramWebhookHandler } from "../apify-async";
import { heartbeatMonitorHandler } from "../scheduled-heartbeat-monitor";
import { serveStatic, setupVite } from "./vite";
import { applySecurityHeaders, createRateLimit, createStrictCors } from "./security";
import { registerMapsJavascriptRoute } from "../maps-javascript";
import { registerAdminRestRoutes } from "../admin-rest";
import { hasValidInternalCronSecret } from "./cron-auth";

async function startServer() {
  const app = express();
  const server = createServer(app);
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
  app.use("/api/trpc", createRateLimit({ windowMs: 60 * 1000, max: 120, name: "trpc" }));
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
  app.post("/api/scheduled/health", noStoreScheduledResponse, (req, res) => {
    if (!hasValidInternalCronSecret(req)) return res.status(403).json({ ok: false, error: "cron-only" });
    return res.json({ ok: true });
  });
  app.post("/api/scheduled/ingest-events", noStoreScheduledResponse, ingestEventsHandler);
  app.post("/api/scheduled/ingest-full-agenda", noStoreScheduledResponse, ingestFullAgendaHandler);
  app.post("/api/scheduled/ingest-event-documents", noStoreScheduledResponse, ingestAgentDocumentsHandler);
  app.post("/api/scheduled/ingest-instagram", noStoreScheduledResponse, asyncIngestInstagramHandler);
  app.post("/api/v2/ingestion/instagram/async", noStoreScheduledResponse, asyncIngestInstagramHandler);
  app.post("/api/scheduled/ingest-instagram-sync", noStoreScheduledResponse, ingestInstagramHandler);
  app.post("/api/webhooks/apify/instagram", noStoreScheduledResponse, apifyInstagramWebhookHandler);
  app.post("/api/scheduled/monitor-heartbeat", noStoreScheduledResponse, heartbeatMonitorHandler);
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
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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

startServer().catch(console.error);
