# Auditoria estrutural — WeekendVibes

Gerado em: 2026-09-17T12:55:40.980Z

Este arquivo reúne cópias integrais dos arquivos-chave solicitados para revisão por outro engenheiro. Os blocos abaixo são delimitados por caminho e linguagem para facilitar leitura, cópia e comparação.

## Índice
1. [package.json](#package-json)
2. [Arquivo principal do servidor/API — server/_core/index.ts](#server-core-index-ts)
3. [Circuit breaker e gerenciamento de falhas — server/circuit-breaker.ts](#server-circuit-breaker-ts)
4. [Extração pública — server/ingestion.ts](#server-ingestion-ts)
5. [Rotina principal do Instagram — server/instagram-pipeline.ts](#server-instagram-pipeline-ts)
6. [Fila de Revisão Manual — client/src/components/ManualReviewPanel.tsx](#client-src-components-manualreviewpanel-tsx)

## package.json

**Caminho:** `package.json`

```json
{
  "name": "weekendvibes",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc --noEmit",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:push": "drizzle-kit generate && drizzle-kit migrate"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.693.0",
    "@aws-sdk/s3-request-presigner": "^3.693.0",
    "@googlemaps/markerclusterer": "^2.6.2",
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-context-menu": "^2.2.16",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-hover-card": "^1.1.15",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.16",
    "@radix-ui/react-navigation-menu": "^1.2.14",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tanstack/react-query": "^5.90.2",
    "@trpc/client": "^11.6.0",
    "@trpc/react-query": "^11.6.0",
    "@trpc/server": "^11.6.0",
    "axios": "^1.12.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "cookie": "^1.0.2",
    "date-fns": "^4.1.0",
    "dotenv": "^17.2.2",
    "drizzle-orm": "^0.44.5",
    "embla-carousel-react": "^8.6.0",
    "express": "^4.21.2",
    "framer-motion": "^12.23.22",
    "input-otp": "^1.4.2",
    "jose": "6.1.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.453.0",
    "mysql2": "^3.15.0",
    "nanoid": "^5.1.5",
    "next-themes": "^0.4.6",
    "react": "^19.2.1",
    "react-day-picker": "^9.11.1",
    "react-dom": "^19.2.1",
    "react-hook-form": "^7.64.0",
    "react-leaflet": "^5.0.0",
    "react-resizable-panels": "^3.0.6",
    "recharts": "^2.15.2",
    "sonner": "^2.0.7",
    "streamdown": "^1.4.0",
    "superjson": "^1.13.3",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^1.1.2",
    "wouter": "^3.3.5",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@builder.io/vite-plugin-jsx-loc": "^0.1.1",
    "@playwright/test": "^1.62.1",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/express": "4.17.21",
    "@types/google.maps": "^3.58.1",
    "@types/leaflet": "^1.9.22",
    "@types/node": "^24.7.0",
    "@types/react": "^19.2.1",
    "@types/react-dom": "^19.2.1",
    "@types/react-test-renderer": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.4",
    "add": "^2.0.6",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.4",
    "esbuild": "^0.25.0",
    "pnpm": "^10.15.1",
    "postcss": "^8.4.47",
    "prettier": "^3.6.2",
    "react-test-renderer": "19.2.1",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.19.1",
    "tw-animate-css": "^1.4.0",
    "typescript": "5.9.3",
    "vite": "^7.1.7",
    "vite-plugin-manus-runtime": "0.0.59",
    "vitest": "^2.1.4"
  },
  "packageManager": "pnpm@10.4.1+sha512.c753b6c3ad7afa13af388fa6d808035a008e30ea9993f58c6663e2bc5ff21679aa834db094987129aa4d488b86df57f7b634981b2f827cdcacc698cc0cfb88af",
  "pnpm": {
    "patchedDependencies": {
      "wouter@3.7.1": "patches/wouter@3.7.1.patch"
    },
    "overrides": {
      "tailwindcss>nanoid": "3.3.7"
    }
  }
}
```

## Arquivo principal do servidor/API — server/_core/index.ts

**Caminho:** `server/_core/index.ts`

```ts
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
  app.post("/api/v2/ingestion/instagram/reprocess-dataset", noStoreScheduledResponse, reprocessApifyStoriesDatasetHandler);
  app.post("/api/scheduled/monitor-heartbeat", noStoreScheduledResponse, heartbeatMonitorHandler);
  app.post("/api/scheduled/export-jobs-recovery", noStoreScheduledResponse, exportJobsRecoveryHandler);
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
```

## Circuit breaker e gerenciamento de falhas — server/circuit-breaker.ts

**Caminho:** `server/circuit-breaker.ts`

```ts
import { getCircuitBreakerStatus, recordCircuitFailure, recordCircuitSuccess } from "./db";

const consecutive403BySource = new Map<string, number>();
const alerted403Sources = new Set<string>();
const HTTP_403_ALERT_THRESHOLD = 3;

function severeFailureThreshold() {
  const configured = Number(process.env.INGESTION_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? 3);
  return Number.isFinite(configured) ? Math.min(10, Math.max(2, Math.trunc(configured))) : 3;
}

function isSevereFailure(input: { status?: number; message: string }) {
  return input.status === 401 || input.status === 403 || /session|cookie|credential|authentication/i.test(input.message);
}

export type CircuitFailureKind = "proxy_or_session" | "upstream";
export type CircuitMachineState = "closed" | "open" | "half_open";

export class CircuitBreakerMachine {
  private state: CircuitMachineState = "closed";
  private failureCount = 0;
  private nextAttemptAt: Date | null = null;

  constructor(private readonly threshold = 3, private readonly cooldownMs = 18 * 60 * 60 * 1000) {}

  snapshot() {
    return { state: this.state, failureCount: this.failureCount, nextAttemptAt: this.nextAttemptAt };
  }

  canAttempt(now = new Date()) {
    if (this.state === "open" && this.nextAttemptAt && now.getTime() < this.nextAttemptAt.getTime()) return false;
    if (this.state === "open") this.state = "half_open";
    return true;
  }

  recordFailure(now = new Date()) {
    this.failureCount = this.state === "half_open" ? this.threshold : this.failureCount + 1;
    if (this.failureCount >= this.threshold) {
      this.state = "open";
      this.nextAttemptAt = new Date(now.getTime() + this.cooldownMs);
      return { ...this.snapshot(), openedNow: true };
    }
    return { ...this.snapshot(), openedNow: false };
  }

  recordSuccess() {
    this.state = "closed";
    this.failureCount = 0;
    this.nextAttemptAt = null;
    return this.snapshot();
  }
}

export function buildCircuitOpenedPayload(input: { sourceKey: string; routine: string; nextAttemptAt: Date; failureCount: number; message: string }) {
  return {
    type: "circuit_opened",
    routine: input.routine.slice(0, 64),
    sourceKey: input.sourceKey.slice(0, 120),
    failureCount: input.failureCount,
    nextAttemptAt: input.nextAttemptAt.toISOString(),
    message: input.message.replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 500),
  };
}

export async function notifyCircuitOpened(payload: ReturnType<typeof buildCircuitOpenedPayload>) {
  const endpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL?.trim();
  if (!endpoint) return false;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(payload) });
    return response.ok;
  } catch (error) {
    console.warn("[CircuitBreaker] webhook unavailable; continuing safely", { message: error instanceof Error ? error.message.slice(0, 180) : "unknown_error" });
    return false;
  }
}

export async function allowSourceAttempt(sourceKey: string) {
  return getCircuitBreakerStatus(sourceKey);
}

export async function registerSourceFailure(input: { sourceKey: string; routine: string; status?: number; message: string }) {
  const is403 = input.status === 403;
  const severe = isSevereFailure(input);
  const next403Count = is403 ? (consecutive403BySource.get(input.sourceKey) ?? 0) + 1 : 0;
  if (is403) consecutive403BySource.set(input.sourceKey, next403Count);
  else if (!severe) {
    consecutive403BySource.delete(input.sourceKey);
    alerted403Sources.delete(input.sourceKey);
  }
  const result = await recordCircuitFailure(input.sourceKey, input.message, input.status, new Date(), undefined, severe);
  if (result.openedNow && result.nextAttemptAt) {
    const payload = buildCircuitOpenedPayload({ sourceKey: input.sourceKey, routine: input.routine, nextAttemptAt: result.nextAttemptAt, failureCount: result.failureCount, message: input.message });
    await notifyCircuitOpened(payload);
  }
  if (is403 && next403Count >= severeFailureThreshold() && !alerted403Sources.has(input.sourceKey)) {
    alerted403Sources.add(input.sourceKey);
    await notifyCircuitOpened({ type: "source_http_403_blocked", routine: input.routine.slice(0, 64), sourceKey: input.sourceKey.slice(0, 120), failureCount: next403Count, nextAttemptAt: new Date().toISOString(), message: `A fonte ${input.sourceKey} respondeu HTTP 403 em ${next403Count} falhas consecutivas.` });
  }
  return result;
}

export async function registerSourceSuccess(sourceKey: string) {
  consecutive403BySource.delete(sourceKey);
  alerted403Sources.delete(sourceKey);
  await recordCircuitSuccess(sourceKey);
}
```

## Extração pública — server/ingestion.ts

**Caminho:** `server/ingestion.ts`

```ts
import crypto from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { assertEventDateIsCurrentOrFuture, getIngestionPayloadCache, listActiveLocationAliasValues, saveEvent, saveIngestionPayloadCache } from "./db";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";
import { fetchExternal, isSandboxRestrictedError, readExternalBody, sanitizeExternalFetchError } from "./external-fetch";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";

const DEFAULT_SOURCE_URLS = [
  "https://articket.com.br/e/6784/plants-happy-hour",
  "https://articket.com.br/",
  "https://blacktag.com.br/",
  "https://www.ingresse.com/reveillon-guaruja-2027/",
  "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
  "https://www.ingresse.com/nosso-after-mc-luuky/",
  "https://www.ingresse.com/nosso-after-14-08/",
  "https://www.ingresse.com/",
  "https://blackpass.com.br/",
  "https://mringressos.com.br/",
];

export const TARGET_VENUES = [
  "vallum garden",
  "valluns garden",
  "moby dick",
  "moby house",
  "ativa house",
  "casa 412",
  "casa412",
  "verilonguinho",
  "meu lugar",
  "goat club",
  "goat dining club",
  "laroc club guaruja",
  "laroc guaruja",
  "lucky scope",
  "curvão surf house",
  "curvao surf house",
  "curvão",
  "curvao",
  "guarujá golf club",
  "praiô",
  "praio",
  "flamingos",
  "flamingo",
  "projac bar",
  "boteco almare",
  "dolores restaurante e bar",
  "dolores bar e restaurante",
  "arena jequitimar",
] as const;

const normalizeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const INGRESSE_SITE_API = "https://api-site.ingresse.com/events";
export const DEFAULT_INGRESSE_FETCH_TIMEOUT_MS = 6_000;
export function getIngresseFetchTimeoutMs() {
  const configured = Number.parseInt(process.env.INGRESSE_FETCH_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_INGRESSE_FETCH_TIMEOUT_MS;
  return Math.min(10_000, Math.max(3_000, configured));
}

function verboseDryRunEnabled() {
  return process.env.INGESTION_VERBOSE_DRY_RUN === "1";
}

function logPublicResponseDiagnostics(input: { url: string; status: number; contentType: string | null; html: string; text: string; structured: boolean; links: number }) {
  if (!verboseDryRunEnabled()) return;
  const parsedUrl = new URL(input.url);
  const jsonLdCount = (input.html.match(/application\/ld\+json/gi) ?? []).length;
  console.info("[Ingestion dry-run] public response", {
    host: parsedUrl.hostname,
    path: parsedUrl.pathname.slice(0, 180),
    status: input.status,
    contentType: input.contentType?.split(";")[0] ?? null,
    bytes: Buffer.byteLength(input.html, "utf8"),
    textLength: input.text.length,
    jsonLdCount,
    discoveredEventLinks: input.links,
    structuredMetadata: input.structured,
  });
}

function logPublicFailureDiagnostics(url: string, error: unknown) {
  if (!verboseDryRunEnabled()) return;
  const parsedUrl = new URL(url);
  const failure = sanitizeFetchFailure(error);
  console.info("[Ingestion dry-run] public failure", {
    host: parsedUrl.hostname,
    path: parsedUrl.pathname.slice(0, 180),
    status: failure.status,
    reason: failure.message,
  });
}


type FetchFailure = { status: number | null; message: string };
type IngresseCacheStore = {
  read: typeof getIngestionPayloadCache;
  write: typeof saveIngestionPayloadCache;
};

function getHttpStatus(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number") return Number((error as { statusCode: number }).statusCode);
  const match = String(error instanceof Error ? error.message : error).match(/\b(?:HTTP|status|respondeu)\s*(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

export function sanitizeFetchFailure(error: unknown): FetchFailure {
  const status = getHttpStatus(error);
  const raw = error instanceof Error ? error.message : String(error ?? "Falha desconhecida");
  const message = raw.replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 240);
  return { status, message: message || "Falha de coleta da fonte pública" };
}

function createFetchError(message: string, statusCode: number | null = null) {
  const error = new Error(message) as Error & { statusCode?: number };
  if (statusCode !== null) error.statusCode = statusCode;
  return error;
}

function ingresseCacheKey(url: string) {
  return `ingresse:${normalizeSlug(getIngresseSlug(url))}`;
}

export function getConfiguredSourceUrls() {
  const focused = process.env.INGESTION_FOCUS_URLS;
  if (focused !== undefined) {
    const focusUrls = focused.split(",").map(value => value.trim()).filter(value => value && value.toUpperCase() !== "DISABLED");
    if (focusUrls.length > 0) return Array.from(new Set(focusUrls));
  }
  const configured = process.env.INGESTION_SOURCE_URL ?? process.env.INGESTION_SOURCE_URLS;
  if (configured !== undefined) {
    let configuredUrls: string[];
    try {
      const parsed = JSON.parse(configured);
      configuredUrls = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean) : [];
    } catch {
      configuredUrls = configured.split(",").map(value => value.trim()).filter(Boolean);
    }
    if (configuredUrls.length === 0) return [];
    return Array.from(new Set([...configuredUrls, ...DEFAULT_SOURCE_URLS]));
  }
  return DEFAULT_SOURCE_URLS;
}

export function containsTargetVenue(value: string, aliases: string[] = []) {
  const normalized = normalizeText(value);
  return [...TARGET_VENUES, ...aliases].some(venue => normalized.includes(normalizeText(venue)));
}

function tokenizeForSimilarity(value: string) {
  return new Set(normalizeSlug(value).split("-").filter(token => token.length > 2));
}

export function areFuzzyDuplicateEvents(left: { title: string; eventDate: Date; city: string }, right: { title: string; eventDate: Date; city: string }) {
  if (left.city !== right.city) return false;
  if (Math.abs(left.eventDate.getTime() - right.eventDate.getTime()) > 36 * 60 * 60 * 1000) return false;
  const a = tokenizeForSimilarity(left.title);
  const b = tokenizeForSimilarity(right.title);
  if (a.size === 0 || b.size === 0) return false;
  const intersection = Array.from(a).filter(token => b.has(token)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union > 0 && intersection / union >= 0.7;
}

export function normalizeVenueCity(locationName: string, address: string, city: string) {
  const venue = normalizeText(`${locationName} ${address}`);
  return /vallum|valluns/.test(venue) && /garden/.test(venue) ? "Santos" : city;
}

export function extractPublicEventLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const absoluteBase = new URL(baseUrl);
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], absoluteBase);
      if (url.origin !== absoluteBase.origin) continue;
      const isArticket = url.pathname.startsWith("/e/") && url.hostname.includes("articket");
      const isBlacktag = url.pathname.startsWith("/eventos/") && url.hostname.includes("blacktag");
      const isZig = url.pathname.startsWith("/eventos/") && (url.hostname === "zig.tickets" || url.hostname.endsWith(".zig.tickets"));
      const isIngresseEvent = url.hostname.includes("ingresse") && url.pathname !== "/" && !url.pathname.startsWith("/search");
      const isBlackPass = url.hostname.endsWith("blackpass.com.br") && /^\/event\/[A-Za-z0-9_-]+/.test(url.pathname);
      const isMrIngressos = url.hostname.endsWith("mringressos.com.br") && /^\/comprar\/[A-Za-z0-9_-]+/.test(url.pathname);
      const anchorText = stripHtml(match[2]);
      const isZigRegional = !isZig || /santos|guaruj[aá]/i.test(normalizeText(anchorText));
      if ((isArticket || isBlacktag || isZig || isIngresseEvent || isBlackPass || isMrIngressos) && isZigRegional) links.add(url.href);
    } catch {
      // Ignore malformed public links.
    }
  }
  const rawPathPattern = /(?:href|url|link)=["'\\]*(\/event\/[A-Za-z0-9_-]+|\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawPathPattern.exec(html))) {
    try {
      const url = new URL(rawMatch[1], absoluteBase);
      if (url.origin === absoluteBase.origin && (url.pathname.startsWith("/event/") || url.pathname.startsWith("/comprar/"))) links.add(url.href);
    } catch { /* ignore malformed embedded paths */ }
  }
  return Array.from(links).slice(0, 60);
}

function readJsonLd(html: string) {
  const matches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const event = values.find(value => {
        if (!value || typeof value !== "object") return false;
        const record = value as Record<string, unknown>;
        return String(record["@type"] ?? "").toLowerCase() === "event" || "startDate" in record;
      });
      if (event && typeof event === "object") return event as Record<string, unknown>;
    } catch {
      // Ignore malformed structured data and continue with metadata fallbacks.
    }
  }
  return undefined;
}

export function parseZigEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = (property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ?? "";
  const title = typeof jsonLd?.name === "string" ? jsonLd.name : meta("og:title");
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : meta("event:start_time");
  const locationName = typeof location.name === "string" ? location.name : "";
  const city = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(stripHtml(html)) ? "Guarujá" : /santos/i.test(stripHtml(html)) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  const text = stripHtml(html).replace(/\s+/g, " ").trim();
  if (!title && !eventDate && !locationName) return undefined;
  return { title, eventDate, locationName, address: street, city, priceCents, sourceUrl: url, imageUrl: meta("og:image"), text: text.slice(0, 16_000) };
}

function isBlackPassEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && /^\/event\//.test(parsed.pathname); } catch { return false; }
}

function isBlackPassRootUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("blackpass.com.br") && ["", "/", "/events"].includes(parsed.pathname.replace(/\/$/, "")); } catch { return false; }
}

const BLACKPASS_EVENTS_API = "https://api.blackpass.com.br/events/list";

type BlackPassCatalogEvent = { id?: string | number; title?: string; name?: string; address?: string; address_comp?: string; city?: string; uf?: string; latlng?: string; dates?: Array<{ dstart?: string; dstop?: string; status?: number }>; poster?: { poster_vertical?: string; poster_horizontal?: string } };

function blackPassEventUrl(id: string | number) {
  return `https://blackpass.com.br/event/${encodeURIComponent(String(id))}`;
}

export function parseBlackPassCatalogEvent(event: BlackPassCatalogEvent) {
  const title = String(event.title ?? event.name ?? "").trim();
  const locationName = String(event.address_comp ?? "").trim();
  const address = String(event.address ?? "").trim();
  const rawCity = String(event.city ?? "").trim();
  const venueText = normalizeText(`${locationName} ${address}`);
  const city = /goat/.test(venueText) || /santos/i.test(rawCity) ? "Santos" : /guaruja|guarujá/i.test(rawCity) ? "Guarujá" : rawCity;
  const dateTime = event.dates?.find(item => item.status !== 0)?.dstart ?? event.dates?.[0]?.dstart ?? "";
  const [latitude, longitude] = String(event.latlng ?? "").split(",").map(value => value.trim());
  const imagePath = event.poster?.poster_vertical || event.poster?.poster_horizontal || "";
  const imageUrl = imagePath.startsWith("http") ? imagePath : imagePath ? `https://api.blackpass.com.br${imagePath}` : "";
  if (!event.id || !title || !dateTime || !locationName) return undefined;
  const sourceUrl = blackPassEventUrl(event.id);
  return { title, summary: title, eventDate: dateTime, locationName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl, imageUrl, latitude: latitude ?? "", longitude: longitude ?? "", text: [title, locationName, address, city, dateTime].filter(Boolean).join(" ") };
}

function parseBlackPassCatalogPayload(payload: unknown): BlackPassCatalogEvent[] {
  const candidates = Array.isArray(payload) ? payload : payload && typeof payload === "object" ? ((payload as { data?: unknown; events?: unknown; results?: unknown }).data ?? (payload as { events?: unknown }).events ?? (payload as { results?: unknown }).results) : [];
  if (!Array.isArray(candidates)) throw createFetchError("Adaptador Black Pass recebeu contrato de catálogo inesperado");
  return candidates.filter((item): item is BlackPassCatalogEvent => Boolean(item && typeof item === "object"));
}

async function fetchBlackPassCatalog(): Promise<BlackPassCatalogEvent[]> {
  const response = await fetchExternal(BLACKPASS_EVENTS_API, { headers: { accept: "application/json" } }, 12_000);
  if (!response.ok) throw createFetchError(`API pública do Black Pass respondeu ${response.status}`, response.status);
  return parseBlackPassCatalogPayload(await response.json() as unknown);
}

async function fetchBlackPassEventPage(url: string): Promise<PublicPage> {
  const id = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const event = (await fetchBlackPassCatalog()).find(item => String(item.id) === id);
  const structured = event ? parseBlackPassCatalogEvent(event) : undefined;
  if (!structured) throw createFetchError(`API pública do Black Pass sem dados essenciais para ${url}`);
  return { url, html: "", text: structured.text, imageUrl: structured.imageUrl, structured, adapter: "blackpass" };
}

function isMrIngressosEventUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("mringressos.com.br") && /^\/comprar\//.test(parsed.pathname); } catch { return false; }
}

function isMrIngressosCatalogUrl(url: string) {
  try { const parsed = new URL(url); return parsed.hostname.endsWith("mringressos.com.br") && ["", "/", "/eventos"].includes(parsed.pathname.replace(/\/$/, "")); } catch { return false; }
}

export function extractMrIngressosListingEvents(html: string, baseUrl = "https://mringressos.com.br/") {
  const events: Array<{ url: string; title: string; text: string }> = [];
  const pattern = /<a\b[^>]*href=["']([^"']*\/comprar\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], baseUrl).href;
      const text = stripHtml(match[2]);
      const heading = match[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
      const title = stripHtml(heading ?? "") || text.match(/(?:\d{1,2}h\d{2})\s+(.+?)(?=\s+(?:Dolores|Boteco|Projac|Tardezinha|Amsterdã|Asipavic|Campo|Quintalzinho|Sede Vicente|G\.R\.C\.E\.S\.)\b|\s+-\s+(?:Guarujá|Guaruja|Santos))/i)?.[1]?.trim() || text.slice(0, 160);
      if (title && !events.some(event => event.url === url)) events.push({ url, title: title.slice(0, 160), text: text.slice(0, 1000) });
    } catch { /* ignore malformed listing links */ }
  }
  return events;
}

export function parseBlackPassEventMetadata(html: string, url: string) {
  return parseTicketingEventMetadata(html, url);
}

export function parseMrIngressosEventMetadata(html: string, url: string) {
  return parseTicketingEventMetadata(html, url);
}

export function parseTicketingEventMetadata(html: string, url: string) {
  const jsonLd = readJsonLd(html);
  const location = jsonLd?.location && typeof jsonLd.location === "object" ? jsonLd.location as Record<string, unknown> : {};
  const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
  const offers = jsonLd?.offers && typeof jsonLd.offers === "object" ? jsonLd.offers as Record<string, unknown> : {};
  const meta = (property: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ?? "";
  const visibleText = stripHtml(html).replace(/\s+/g, " ");
  const h1Text = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = typeof jsonLd?.name === "string" ? jsonLd.name : meta("og:title") || stripHtml(h1Text) || stripHtml(pageTitle);
  const eventDate = typeof jsonLd?.startDate === "string" ? jsonLd.startDate : (meta("event:start_time") || visibleText.match(/(?:sex|sab|dom|seg|ter|qua|qui)[^0-9]{0,20}(\d{1,2})[\/ .-]+([a-záéêç]+|\d{1,2})[^0-9]{0,12}(\d{1,2})h?(\d{2})?/i)?.[0] || "");
  const locationName = typeof location.name === "string" ? location.name : (visibleText.match(/(?:Guarujá|Guaruja|Santos)[^,|]{0,80}/i)?.[0] ?? "").trim();
  const city = typeof address.addressLocality === "string" ? address.addressLocality : (/guaruj[aá]/i.test(visibleText) ? "Guarujá" : /santos/i.test(visibleText) ? "Santos" : "");
  const street = typeof address.streetAddress === "string" ? address.streetAddress : "";
  const priceRaw = typeof offers.price === "number" || typeof offers.price === "string" ? String(offers.price) : "";
  const priceCents = priceRaw ? Math.round(Number(priceRaw.replace(/[^0-9,.-]/g, "").replace(",", ".")) * 100) : 0;
  if (!title && !eventDate && !locationName) return undefined;
  return { title, eventDate, locationName, address: street, city, priceCents, sourceUrl: url, imageUrl: meta("og:image"), text: visibleText.slice(0, 16_000) };
}

function isIngresseEventUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    return parsed.hostname.endsWith("ingresse.com") && path.length > 1 && !["/login", "/register", "/search"].includes(path);
  } catch {
    return false;
  }
}

function getIngresseSlug(url: string) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "");
}

export async function fetchIngresseEventApi(url: string, cacheStore: IngresseCacheStore = { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options: { dryRun?: boolean } = {}) {
  const slug = getIngresseSlug(url);
  if (!slug) throw createFetchError(`URL Ingresse sem slug de evento: ${url}`);
  try {
    const response = await fetchExternal(`${INGRESSE_SITE_API}/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } }, getIngresseFetchTimeoutMs(), true);
    if (!response.ok) throw createFetchError(`API pública do Ingresse respondeu ${response.status}`, response.status);
    const payload = JSON.parse(await readExternalBody(response)) as Record<string, unknown>;
    const place = payload.place && typeof payload.place === "object" ? payload.place as Record<string, unknown> : {};
    const session = Array.isArray(payload.sessions) && payload.sessions[0] && typeof payload.sessions[0] === "object" ? payload.sessions[0] as Record<string, unknown> : {};
    const location = place.location && typeof place.location === "object" ? place.location as Record<string, unknown> : {};
    const title = typeof payload.title === "string" ? payload.title : "";
    const description = typeof payload.description === "string" ? stripHtml(payload.description) : "";
    const placeName = typeof place.name === "string" ? place.name : "";
    const city = typeof place.city === "string" ? place.city : "";
    const address = [place.street, city, place.state].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ");
    const dateTime = typeof session.dateTime === "string" ? session.dateTime : "";
    const poster = payload.poster && typeof payload.poster === "object" ? payload.poster as Record<string, unknown> : {};
    const imageUrl = [poster.large, poster.medium, poster.small].find((value): value is string => typeof value === "string" && value.startsWith("http")) ?? "";
    const latitude = typeof location.lat === "number" ? String(location.lat) : "";
    const longitude = typeof location.lon === "number" ? String(location.lon) : "";
    const text = [title, description, placeName, address, city, dateTime].filter(Boolean).join(" ");
    if (!title || !dateTime || !placeName) throw createFetchError(`API pública do Ingresse sem dados essenciais para ${url}`);
    const structured = { title, summary: description, eventDate: dateTime, locationName: placeName, address, city, category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: url, imageUrl, latitude, longitude };
    if (!options.dryRun) await cacheStore.write({ cacheKey: ingresseCacheKey(url), sourceKey: "public:ingresse", sourceUrl: url, payload: structured, latitude, longitude }).catch(error => console.warn("[Ingestion cache] Could not save Ingresse payload:", sanitizeFetchFailure(error).message));
    return { url, html: "", text: text.slice(0, 16_000), imageUrl, structured };
  } catch (error) {
    const failure = sanitizeFetchFailure(error);
    // Um 403 indica bloqueio explícito do provedor; não reutilizamos cache potencialmente obsoleto.
    if (failure.status === 403) throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure });
    const cached = await cacheStore.read(ingresseCacheKey(url)).catch(() => undefined);
    if (cached) {
      try {
        const structured = JSON.parse(cached.payload) as Record<string, string | number>;
        const text = Object.values(structured).filter(value => typeof value === "string").join(" ");
        return { url, html: "", text: text.slice(0, 16_000), imageUrl: String(structured.imageUrl ?? ""), structured, cacheFallback: { used: true as const, status: failure.status, message: failure.message }, fetchFailure: failure };
      } catch {
        // Ignore malformed cache and preserve the original fetch failure.
      }
    }
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure });
  }
}

type PublicPage = {
  url: string;
  html: string;
  text: string;
  imageUrl: string;
  adapter?: "blackpass" | "mringressos" | "ingresse" | "generic";
  adapterError?: string;
  durationMs?: number;
  structured?: Record<string, string | number>;
  cacheFallback?: { used: true; status: number | null; message: string };
  fetchFailure?: FetchFailure;
  circuitOpen?: boolean;
};

export function publicSourceKey(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ingresse")) return "public:ingresse";
    if (host.includes("blacktag")) return "public:blacktag";
    if (host.includes("blackpass")) return "public:blackpass";
    if (host.includes("mringressos")) return "public:mringressos";
    if (host.includes("articket")) return "public:articket";
    if (host.endsWith("zig.tickets")) return "public:zig";
  } catch {
    // Keep malformed URLs under the generic public source.
  }
  return "public:unknown";
}

async function guardedFetchPublicPage(url: string, options: { dryRun?: boolean } = {}): Promise<PublicPage> {
  const startedAt = Date.now();
  const sourceKey = publicSourceKey(url);
  if (!options.dryRun) {
    const circuit = await allowSourceAttempt(sourceKey);
    if (!circuit.allowed) return { url, html: "", text: "", imageUrl: "", circuitOpen: true };
  }
  try {
    const page = await fetchPublicPage(url, options);
    if (!options.dryRun) await registerSourceSuccess(sourceKey);
    return { ...page, durationMs: Math.max(0, Date.now() - startedAt) };
  } catch (error) {
    const failure = sanitizeFetchFailure(error);
    logPublicFailureDiagnostics(url, error);
    if (!options.dryRun) await registerSourceFailure({ sourceKey, routine: "public-agenda", status: failure.status ?? undefined, message: failure.message });
    throw Object.assign(error instanceof Error ? error : new Error(failure.message), { fetchFailure: failure, fetchDurationMs: Math.max(0, Date.now() - startedAt) });
  }
}

const PUBLIC_FETCH_TIMEOUT_MS = 12_000;
export const ARTICKET_FETCH_TIMEOUT_MS = 30_000;
function publicFetchTimeoutMs(url: string) {
  const sourceKey = publicSourceKey(url);
  if (sourceKey === "public:articket") return ARTICKET_FETCH_TIMEOUT_MS;
  if (sourceKey === "public:ingresse") return getIngresseFetchTimeoutMs();
  return PUBLIC_FETCH_TIMEOUT_MS;
}
export const MR_INGRESSOS_RETRY_ATTEMPTS = 3;
export const MR_INGRESSOS_RETRY_BASE_DELAY_MS = 250;

export function isTimeoutFailure(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return name === "TimeoutError" || name === "AbortError" || /timeout|timed out|aborted/i.test(message);
}

export async function fetchMrIngressosWithRetry(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MR_INGRESSOS_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      lastError = error;
      if (!isTimeoutFailure(error) || attempt === MR_INGRESSOS_RETRY_ATTEMPTS - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, MR_INGRESSOS_RETRY_BASE_DELAY_MS * (2 ** attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha de timeout no Mr Ingressos");
}
const MR_INGRESSOS_FETCH_TIMEOUT_MS = 20_000;
const PUBLIC_FETCH_CONCURRENCY = 6;

function buildPreviewPublicMockResult(sourceKey: string, candidateCount: number, durationMs: number, dryRun: boolean) {
  return {
    imported: 0,
    persisted: 0,
    added: 0,
    updated: 0,
    ignored: 0,
    dryRun,
    dryRunAcceptedEvents: dryRun ? 3 : 0,
    read: 3,
    filtered: 0,
    duplicates: 0,
    missingCoordinates: 0,
    outOfBoundsCoordinates: 0,
    skipped: false,
    discovered: 3,
    matchedSources: 3,
    fallbackUsed: 0,
    fetchFailures: 0,
    sandboxRestricted: true,
    previewMock: true,
    filteredByReason: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 },
    filteredSourceUrls: [],
    sourceReports: [{ sourceKey, read: 3, filtered: 0, persistable: dryRun ? 3 : 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], durationMs, medianDurationMs: durationMs, p95DurationMs: durationMs, rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
  };
}

async function fetchWithConcurrency<T>(items: string[], worker: (item: string) => Promise<T>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try { results[index] = { status: "fulfilled", value: await worker(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, runWorker));
  return results;
}

async function fetchPublicPage(url: string, options: { dryRun?: boolean } = {}): Promise<PublicPage> {
  if (isIngresseEventUrl(url)) return fetchIngresseEventApi(url, { read: getIngestionPayloadCache, write: saveIngestionPayloadCache }, options);
  if (isBlackPassEventUrl(url)) return fetchBlackPassEventPage(url);
  try {
    const requestInit: RequestInit = {
      headers: {
        "user-agent": "WeekendVibesBot/1.0 (+public-event-ingestion)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(isMrIngressosEventUrl(url) ? MR_INGRESSOS_FETCH_TIMEOUT_MS : publicFetchTimeoutMs(url)),
    };
    const response = isMrIngressosEventUrl(url)
      ? await fetchMrIngressosWithRetry(url, requestInit, (targetUrl: string | URL | Request, targetInit?: RequestInit) => fetchExternal(targetUrl instanceof Request ? targetUrl.url : String(targetUrl), targetInit ?? {}, MR_INGRESSOS_FETCH_TIMEOUT_MS))
      : await fetchExternal(url, requestInit, publicFetchTimeoutMs(url));
    const html = await readExternalBody(response);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) throw createFetchError("Fonte pública retornou conteúdo vazio");
    const hostname = new URL(url).hostname;
    const structured = hostname.endsWith("zig.tickets") ? parseZigEventMetadata(html, url) : (isBlackPassEventUrl(url) ? parseBlackPassEventMetadata(html, url) : isMrIngressosEventUrl(url) ? parseMrIngressosEventMetadata(html, url) : undefined);
    const normalizedText = structured?.text.slice(0, 8000) ?? text.slice(0, 8000);
    logPublicResponseDiagnostics({ url, status: response.status, contentType: response.headers.get("content-type"), html, text: normalizedText, structured: Boolean(structured), links: extractPublicEventLinks(html, url).length });
    const adapter = hostname.endsWith("blackpass.com.br") ? "blackpass" : hostname.endsWith("mringressos.com.br") ? "mringressos" : hostname.includes("ingresse") ? "ingresse" : "generic";
    const adapterError = (isBlackPassEventUrl(url) || isMrIngressosEventUrl(url)) && !structured ? `Adaptador ${adapter} não encontrou JSON-LD/metadados completos; conteúdo textual encaminhado para a classificação.` : undefined;
    return { url, html, text: normalizedText, imageUrl: structured?.imageUrl ?? imageMatch?.[1] ?? "", structured, adapter, adapterError };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(sanitizeFetchFailure(error).message), { fetchFailure: sanitizeFetchFailure(error) });
  }
}

async function discoverCandidatePages(options: IngestionPipelineOptions = {}) {
  const configuredBases = getConfiguredSourceUrls();
  const bases = options.sourceKey
    ? configuredBases.filter(url => options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey)
    : configuredBases;
  const discovered = new Set(bases);
  const basePages = await fetchWithConcurrency(bases, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  for (let index = 0; index < basePages.length; index += 1) {
    const result = basePages[index];
    if (result.status !== "fulfilled") continue;
    const baseUrl = bases[index];
    for (const link of extractPublicEventLinks(result.value.html, result.value.url)) discovered.add(link);
    if (isMrIngressosCatalogUrl(baseUrl)) {
      for (const event of extractMrIngressosListingEvents(result.value.html, result.value.url)) discovered.add(event.url);
    }
    if (isBlackPassRootUrl(baseUrl)) {
      const catalog = await fetchBlackPassCatalog().catch(error => { logPublicFailureDiagnostics(baseUrl, error); return []; });
      if (catalog.length === 0) logPublicFailureDiagnostics(baseUrl, createFetchError("Adaptador Black Pass não encontrou eventos no catálogo público"));
      for (const event of catalog) if (event.id) discovered.add(blackPassEventUrl(event.id));
    }
  }
  return Array.from(discovered).filter(url => {
    try {
      const host = new URL(url).hostname;
      const belongsToSource = !options.sourceKey || options.sourceKey === "public" || publicSourceKey(url) === options.sourceKey;
      return belongsToSource && (!host.endsWith("zig.tickets") || url !== "https://zig.tickets/pt-BR");
    } catch { return false; }
  }).slice(0, 120);
}

export type IngestionSourceReport = {
  sourceKey: string;
  read: number;
  filtered: number;
  persistable: number;
  added: number;
  updated: number;
  ignored: number;
  duplicates: number;
  errors: Array<{ sourceUrl?: string; status: number | null; message: string }>;
  durationMs: number;
  medianDurationMs: number;
  p95DurationMs: number;
  rejectionReasons: { fetchFailed: number; outsideTargetVenue: number; invalidStructuredEvent: number; duplicate: number; pastEvent: number };
};

export type IngestionPipelineOptions = { dryRun?: boolean; sourceKey?: string };
type PublicSourceReportInput = {
  candidateUrls: string[];
  pages: PromiseSettledResult<PublicPage>[];
  payloadEvents?: Array<Record<string, string | number>>;
  acceptedEvents?: Array<{ sourceKey: string }>;
  rejectedEvents?: Array<{ sourceKey: string; reason: "invalidStructuredEvent" | "pastEvent" }>;
  duplicateSourceKeys?: string[];
  sourceOutcomes?: Array<{ sourceKey: string; created: boolean; updated: boolean }>;
  matchesTargetVenue?: (value: string) => boolean;
};

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function buildPublicSourceReports(input: PublicSourceReportInput): IngestionSourceReport[] {
  const reports = new Map<string, IngestionSourceReport & { latencySamples: number[] }>();
  const getReport = (sourceKey: string) => {
    const current = reports.get(sourceKey);
    if (current) return current;
    const created: IngestionSourceReport & { latencySamples: number[] } = {
      sourceKey,
      read: 0,
      filtered: 0,
      persistable: 0,
      added: 0,
      updated: 0,
      ignored: 0,
      duplicates: 0,
      errors: [],
      durationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      latencySamples: [],
      rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 },
    };
    reports.set(sourceKey, created);
    return created;
  };
  input.candidateUrls.forEach((url, index) => {
    const report = getReport(publicSourceKey(url));
    report.read += 1;
    const page = input.pages[index];
    if (!page || page.status === "rejected") {
      report.rejectionReasons.fetchFailed += 1;
      if (page?.status === "rejected") {
        const failure = sanitizeFetchFailure(page.reason);
        const durationMs = page.reason && typeof page.reason === "object" && "fetchDurationMs" in page.reason ? Number((page.reason as { fetchDurationMs?: unknown }).fetchDurationMs ?? 0) : 0;
        const safeDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
        report.durationMs += safeDurationMs;
        report.latencySamples.push(safeDurationMs);
        report.errors.push({ sourceUrl: url, status: failure.status, message: failure.message });
      }
      return;
    }
    const durationMs = Math.max(0, Number(page.value.durationMs ?? 0));
    report.durationMs += durationMs;
    report.latencySamples.push(durationMs);
    if (page.value.circuitOpen) {
      report.rejectionReasons.fetchFailed += 1;
      report.errors.push({ sourceUrl: url, status: null, message: "Fonte pausada pelo Circuit Breaker durante o cooldown." });
    } else if (input.matchesTargetVenue && !input.matchesTargetVenue(page.value.text)) {
      report.filtered += 1;
      report.rejectionReasons.outsideTargetVenue += 1;
    } else if (page.value.cacheFallback?.used) {
      report.errors.push({ sourceUrl: url, status: page.value.cacheFallback.status, message: `Fallback utilizado: ${page.value.cacheFallback.message}` });
    }
    if (page.value.adapterError) {
      report.errors.push({ sourceUrl: url, status: null, message: page.value.adapterError });
    }
  });
  for (const event of input.acceptedEvents ?? []) getReport(event.sourceKey).persistable += 1;
  for (const rejected of input.rejectedEvents ?? []) {
    const report = getReport(rejected.sourceKey);
    report.filtered += 1;
    report.rejectionReasons[rejected.reason] += 1;
  }
  for (const sourceKey of input.duplicateSourceKeys ?? []) {
    const report = getReport(sourceKey);
    report.duplicates += 1;
    report.ignored += 1;
    report.filtered += 1;
    report.rejectionReasons.duplicate += 1;
  }
  for (const outcome of input.sourceOutcomes ?? []) {
    const report = getReport(outcome.sourceKey);
    if (outcome.created) report.added += 1;
    else if (outcome.updated) report.updated += 1;
    else report.ignored += 1;
  }
  return Array.from(reports.values()).map(report => ({
    ...report,
    ignored: report.filtered,
    medianDurationMs: percentile(report.latencySamples, 50),
    p95DurationMs: percentile(report.latencySamples, 95),
    latencySamples: undefined,
  })).map(({ latencySamples: _latencySamples, ...report }) => report).sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
}

export async function runIngestionPipeline(options: IngestionPipelineOptions = {}) {
  const dryRun = options.dryRun === true;
  const activeAliases = await listActiveLocationAliasValues();
  const matchesTargetVenue = (value: string) => containsTargetVenue(value, activeAliases);
  const candidateUrls = await discoverCandidatePages(options);
  if (candidateUrls.length === 0) return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: true, reason: "Nenhuma fonte de ingestão configurada", sourceReports: [] as IngestionSourceReport[] };
  const pages = await fetchWithConcurrency(candidateUrls, url => guardedFetchPublicPage(url, options), PUBLIC_FETCH_CONCURRENCY);
  const fulfilledPages = pages
    .filter((result): result is PromiseFulfilledResult<PublicPage> => result.status === "fulfilled")
    .map(result => result.value);
  const fallbackPages = fulfilledPages.filter(page => page.cacheFallback?.used);
  const circuitOpenPages = fulfilledPages.filter(page => page.circuitOpen === true);
  const rejectedPages = pages.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const fetchFailures = [
    ...circuitOpenPages.map(page => ({ sourceUrl: page.url, status: null, message: "Fonte pausada pelo Circuit Breaker durante o cooldown.", fallbackUsed: false })),
    ...fallbackPages.map(page => ({ sourceUrl: page.url, ...page.cacheFallback, status: page.cacheFallback?.status ?? null })),
    ...rejectedPages.map((result, index) => ({ sourceUrl: candidateUrls[index], ...sanitizeFetchFailure(result.reason) })),
  ].map(failure => ({ sourceUrl: String(failure.sourceUrl).slice(0, 1000), status: failure.status ?? null, message: String(failure.message).slice(0, 240), fallbackUsed: "used" in failure && failure.used === true }));
  const fetchFailed = fetchFailures.length;
  const outsideTargetVenue = fulfilledPages.filter(page => !matchesTargetVenue(page.text)).length;
  const sourcePages = fulfilledPages.filter(page => matchesTargetVenue(page.text));
  const filteredByReason = { fetchFailed, outsideTargetVenue, invalidStructuredEvent: 0, pastEvent: 0, duplicate: 0 };
  const filteredSourceUrls = pages.flatMap((result, index) => result.status === "rejected" || !matchesTargetVenue(result.status === "fulfilled" ? result.value.text : "") ? [candidateUrls[index]] : []);

  if (sourcePages.length === 0) {
    const sandboxFailure = rejectedPages.some(result => isSandboxRestrictedError(result.reason));
    if (sandboxFailure && shouldUseSandboxMocks()) {
      return buildPreviewPublicMockResult(
        options.sourceKey ?? "public:preview",
        candidateUrls.length,
        Math.max(1, rejectedPages.reduce((sum, result) => sum + Number((result.reason as { fetchDurationMs?: unknown })?.fetchDurationMs ?? 1), 0)),
        dryRun
      );
    }
    return { imported: 0, persisted: 0, dryRun, dryRunAcceptedEvents: 0, read: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, skipped: false, discovered: candidateUrls.length, matchedSources: 0, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, reason: "Nenhum evento dos locais-alvo encontrado nas fontes públicas", sourceReports: buildPublicSourceReports({ candidateUrls, pages, matchesTargetVenue }) };
  }

  const apiStructuredEvents = sourcePages
    .flatMap(page => "structured" in page && page.structured ? [page.structured] : []);
  const rawText = sourcePages
    .map(page => `SOURCE_URL: ${page.url}\nIMAGE_URL: ${page.imageUrl}\nCONTENT: ${page.text}`)
    .join("\n\n")
    .slice(0, 48_000);

  const structured = apiStructuredEvents.length > 0 ? { choices: [{ message: { content: JSON.stringify({ events: apiStructuredEvents }) } }] } : await invokeLLM({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Extraia somente eventos públicos de música, shows ou baladas nos locais oficiais Vallum Garden, Moby Dick, Ativa House, Casa 412, Verilonguinho, Meu Lugar, Goat Club, Laroc Club Guarujá, Lucky Scope, Curvão Surf House, Guarujá Golf Club, Praiô, Flamingos, Projac Bar, Boteco Almare, Dolores Restaurante e Bar ou Arena Jequitimar, localizados exclusivamente em Santos ou Guarujá. Ignore eventos passados, cidades diferentes, locais fora dessa allowlist e eventos de gastronomia, esporte, teatro ou exposição sem música. Retorne somente JSON no schema. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Se o gênero não puder ser inferido com segurança, descarte o evento. Use o SOURCE_URL correspondente como sourceUrl e IMAGE_URL quando houver." },
      { role: "user", content: rawText },
    ],
    response_format: { type: "json_schema", json_schema: { name: "event_batch", strict: true, schema: { type: "object", properties: { events: { type: "array", items: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string" }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }, latitude: { type: "string" }, longitude: { type: "string" } }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "sourceUrl", "imageUrl", "latitude", "longitude"], additionalProperties: false } } }, required: ["events"], additionalProperties: false } } },
  });

  const payload = JSON.parse(String(structured.choices?.[0]?.message?.content ?? "{\"events\":[]}")) as { events: Array<Record<string, string | number>> };
  let imported = 0;
  let added = 0;
  let updated = 0;
  let duplicates = 0;
  const simulation = dryRun || verboseDryRunEnabled();
  let dryRunAcceptedEvents = 0;
  let missingCoordinates = 0;
  let outOfBoundsCoordinates = 0;
  const acceptedEvents: Array<{ title: string; eventDate: Date; city: string; sourceKey: string }> = [];
  const rejectedEvents: Array<{ sourceKey: string; reason: "invalidStructuredEvent" | "pastEvent" }> = [];
  const duplicateSourceKeys: string[] = [];
  const sourceOutcomes: Array<{ sourceKey: string; created: boolean; updated: boolean }> = [];
  for (const event of payload.events) {
    const date = new Date(String(event.eventDate));
    const locationName = String(event.locationName);
    const address = String(event.address);
    const city = normalizeVenueCity(locationName, address, String(event.city));
    const category = String(event.category);
    const genre = String(event.genre);
    const sourceKey = publicSourceKey(String(event.sourceUrl ?? ""));
    if (Number.isNaN(date.getTime()) || (city !== "Santos" && city !== "Guarujá") || !matchesTargetVenue(`${locationName} ${address}`) || !["show", "balada", "evento_musical"].includes(category) || !["funk", "house_eletronica", "samba_pagode", "rap_trap"].includes(genre)) {
      filteredByReason.invalidStructuredEvent += 1;
      rejectedEvents.push({ sourceKey, reason: "invalidStructuredEvent" });
      continue;
    }
    try { assertEventDateIsCurrentOrFuture(date, new Date(), String(event.title)); } catch { filteredByReason.pastEvent += 1; rejectedEvents.push({ sourceKey, reason: "pastEvent" }); continue; }
    const sourceUrl = String(event.sourceUrl);
    const fuzzyDuplicate = acceptedEvents.some(previous => areFuzzyDuplicateEvents(previous, { title: String(event.title), eventDate: date, city }));
    if (fuzzyDuplicate) { duplicates += 1; duplicateSourceKeys.push(sourceKey); continue; }
    acceptedEvents.push({ title: String(event.title), eventDate: date, city, sourceKey });
    const sourceHash = crypto.createHash("md5").update(`${normalizeSlug(String(event.sourceUrl))}:${normalizeSlug(String(event.title))}:${date.toISOString().slice(0, 10)}`).digest("hex");
    const sourceType = sourceUrl.includes("ingresse.com") ? "ingresse" : sourceUrl.includes("blackpass.com.br") ? "blackpass" : sourceUrl.includes("mringressos.com.br") ? "mringressos" : "public_source";
    const latitude = String(event.latitude || "");
    const longitude = String(event.longitude || "");
    if (!latitude || !longitude) missingCoordinates += 1;
    else {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!(lat >= -24.15 && lat <= -23.85 && lng >= -46.45 && lng <= -46.05)) outOfBoundsCoordinates += 1;
    }
    if (simulation) {
      dryRunAcceptedEvents += 1;
      continue;
    }
    const saved = await saveEvent({ title: String(event.title), slug: `${normalizeSlug(String(event.title))}-${date.getTime()}`, description: String(event.summary), eventDate: date, locationName: String(event.locationName), address: String(event.address), city, category: category as "show" | "balada" | "evento_musical", genre, priceCents: Number(event.priceCents) || 0, sourceUrl, sourceType, imageUrl: String(event.imageUrl || ""), latitude, longitude, sourceHash, isPublished: 1 });
    if (!saved || typeof saved !== "object") {
      added += 1;
      sourceOutcomes.push({ sourceKey, created: true, updated: false });
    } else if (saved.created) {
      added += 1;
      sourceOutcomes.push({ sourceKey, created: true, updated: false });
    } else if (saved.updated) {
      updated += 1;
      sourceOutcomes.push({ sourceKey, created: false, updated: true });
    } else {
      duplicates += 1;
      duplicateSourceKeys.push(sourceKey);
      sourceOutcomes.push({ sourceKey, created: false, updated: false });
    }
    imported += 1;
  }
  const sourceReports = buildPublicSourceReports({ candidateUrls, pages, payloadEvents: payload.events, acceptedEvents, rejectedEvents, duplicateSourceKeys, sourceOutcomes, matchesTargetVenue });
  const persistedCount = simulation ? 0 : added + updated;
  const contentFiltered = filteredByReason.invalidStructuredEvent + filteredByReason.pastEvent;
  const read = simulation ? 0 : persistedCount + contentFiltered + duplicates;
  const ignored = contentFiltered + duplicates;
  return { imported, persisted: persistedCount, added: simulation ? 0 : added, updated: simulation ? 0 : updated, ignored, dryRun: simulation, dryRunAcceptedEvents, read, filtered: contentFiltered, duplicates, missingCoordinates, outOfBoundsCoordinates, skipped: false, discovered: candidateUrls.length, matchedSources: sourcePages.length, fallbackUsed: fallbackPages.length, fetchFailures, filteredByReason, filteredSourceUrls, sourceReports };
}
```

## Rotina principal do Instagram — server/instagram-pipeline.ts

**Caminho:** `server/instagram-pipeline.ts`

```ts
import crypto from "node:crypto";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, listActiveLocationAliasValues, listEnabledInstagramSources, markIngestionSourceResult, recordOperationalAlert, saveEvent } from "./db";
import { fetchExternal, isSandboxRestrictedError, readExternalBody } from "./external-fetch";
import { shouldUseSandboxMocks } from "./ingestion-preview-settings";
import { containsTargetVenue } from "./ingestion";
import { parseMetaBusinessDiscovery } from "./contracts/external";
import { resolveRegionalCoordinates } from "./geocoding";
import { allowSourceAttempt, registerSourceFailure, registerSourceSuccess } from "./circuit-breaker";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const LOOKBACK_DAYS = 5;
export function getInstagramSaoPauloDate(now = new Date()) {
  return saoPauloCalendarDate(now);
}

export function getInstagramReferenceDate(now = new Date()) {
  return getInstagramSaoPauloDate(now);
}

export function isInstagramReferenceDateAligned(referenceDate: string, now = new Date()) {
  return getInstagramSaoPauloDate(now) === referenceDate;
}

export async function recordReferenceDateClockAlert(referenceDate: string, now = new Date()) {
  const systemDate = getInstagramSaoPauloDate(now);
  if (systemDate === referenceDate) return true;
  await recordOperationalAlert({
    integration: "pipeline",
    alertType: "reference_date_clock_desync",
    severity: "CRITICAL",
    title: "Desalinhamento da data de referência do Instagram",
    message: `Data de referência ${referenceDate} diverge da data do sistema em America/Sao_Paulo (${systemDate}).`,
  });
  return false;
}

export type InstagramIntegration = "meta" | "ocr" | "openai";

/** Marcadores de praça usados pelos estabelecimentos da Baixada Santista. */
export const REGIONAL_HASHTAGS = ["#Guarujá", "#Santos"] as const;

/** Origem da mídia, preparada para um futuro conector oficial de Stories. */
export type InstagramMediaOrigin = "post" | "story" | "highlight";

export class InstagramIntegrationFailure extends Error {
  constructor(public readonly integration: InstagramIntegration, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "InstagramIntegrationFailure";
  }
}

/** Extrai somente o status HTTP da mensagem redigida do upstream Meta. */
export function getMetaFailureStatus(error: unknown) {
  if (!(error instanceof InstagramIntegrationFailure) || error.integration !== "meta") return null;
  const match = error.message.match(/HTTP (\d{3})/i);
  return match ? Number(match[1]) : null;
}

/** Falhas conhecidas do upstream podem degradar para agenda vazia sem dados forjados. */
export function isGracefullyDegradedMetaFailure(error: unknown) {
  const status = getMetaFailureStatus(error);
  return status !== null && [401, 403, 408, 429, 500, 502, 503, 504].includes(status);
}

let instagramSessionGeneration = 0;

/**
 * Business Discovery uses the official Graph API and does not maintain a
 * browser/proxy session. This generation invalidates any request context used
 * by a retry without attempting to bypass Meta controls or rotate IPs.
 */
export function resetInstagramSessionForRetry(reason: string) {
  instagramSessionGeneration += 1;
  console.warn("[Instagram] request context invalidated for next retry", { reason: normalizeDiagnosticText(reason, 80), sessionGeneration: instagramSessionGeneration });
  return instagramSessionGeneration;
}

export function getInstagramSessionGeneration() {
  return instagramSessionGeneration;
}

export function isInstagramTransportFailure(status: number, body = "") {
  return [401, 403, 502].includes(status) || /invalid proxy response|proxy response|session|forbidden|authentication/i.test(body);
}

export const INSTAGRAM_TARGETS = [
  { name: "Moby House", username: "mobydicksantos", directUrl: "https://www.instagram.com/mobydicksantos/" },
  { name: "Projac Bar", username: "projac.bar", directUrl: "https://www.instagram.com/projac.bar/" },
  { name: "Meu Lugar Bar e Entretenimento", username: "meulugar.bar", directUrl: "https://www.instagram.com/meulugar.bar/" },
  { name: "Nosso After", username: "nossoafterguaruja", directUrl: "https://www.instagram.com/nossoafterguaruja/" },
  { name: "Curvão Surf House", username: "curvaosurfhouse", directUrl: "https://www.instagram.com/curvaosurfhouse/" },
  { name: "Flamingo Bar", username: "flamingomusicbar", directUrl: "https://www.instagram.com/flamingomusicbar/" },
  { name: "Rocket Sea Club", username: "rocketseaclub", directUrl: "https://www.instagram.com/rocketseaclub/" },
  { name: "Ativa House", username: "ativahouse", directUrl: "https://www.instagram.com/ativahouse/" },
] as const;

export type InstagramPost = {
  id?: string;
  shortCode?: string;
  url?: string;
  permalink?: string;
  caption?: string;
  text?: string;
  timestamp?: string | number;
  takenAt?: string | number;
  postedAt?: string | number;
  expiresAt?: string | number;
  displayUrl?: string;
  imageUrl?: string;
  media_url?: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  isVideo?: boolean;
  ownerUsername?: string;
  username?: string;
  sourceKey?: string;
  mediaType?: InstagramMediaOrigin;
  highlightTitle?: string;
  ocrText?: string;
};

export type InstagramOcrAuditItem = {
  mediaOrigin: InstagramMediaOrigin;
  imageUrl: string;
  sourceUrl: string;
  highlightTitle: string | null;
  ocrText: string;
  rawText: string;
};

export function buildOcrAuditEntries(posts: Array<{ post: InstagramPost; rawText: string }>): InstagramOcrAuditItem[] {
  return posts.slice(0, 25).map(({ post, rawText }) => ({
    mediaOrigin: post.mediaType ?? "post",
    imageUrl: String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").slice(0, 1000),
    sourceUrl: postUrl(post).slice(0, 1000),
    highlightTitle: post.highlightTitle ? String(post.highlightTitle).slice(0, 160) : null,
    ocrText: String(post.ocrText ?? "").slice(0, 3000),
    rawText: rawText.slice(0, 5000),
  })).filter(item => item.imageUrl.startsWith("https://") || item.ocrText.length > 0 || item.rawText.length > 0);
}

export const INSTAGRAM_AGENDA_TITLE_REGEX = /programa(?:ção|cao)|agenda/i;

export function isAgendaHighlightTitle(title: unknown) {
  return INSTAGRAM_AGENDA_TITLE_REGEX.test(String(title ?? "").normalize("NFC"));
}

export function buildInstagramScraperPayload(targets: ReadonlyArray<{ username: string; directUrl: string }>) {
  return {
    directUrls: targets.map(target => target.directUrl),
    usernames: targets.map(target => target.username),
    resultsType: "details",
    resultsLimit: 25,
    stories: true,
    highlights: true,
    includeStories: true,
    includeHighlights: true,
  } as const;
}

/** Input contract for the dedicated Stories Actor; kept separate from the profile/posts Actor contract. */
export const DEFAULT_APIFY_ACTOR_MAX_RUNTIME_SECS = 45;
export function getApifyActorMaxRuntimeSecs() {
  const configured = Number.parseInt(process.env.APIFY_ACTOR_MAX_RUNTIME_SECS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_APIFY_ACTOR_MAX_RUNTIME_SECS;
  return Math.min(60, Math.max(20, configured));
}

export function buildInstagramStoriesScraperPayload(targets: ReadonlyArray<{ username: string }>) {
  return {
    targets: targets.map(target => target.username),
    scrapeType: "both" as const,
    maxHighlights: 10,
    onlyNew: false,
  } as const;
}

export function normalizeInstagramMediaItem(item: Record<string, unknown>, fallbackUsername = ""): InstagramPost | null {
  const rawType = [item.item_type, item.type, item.mediaType, item.productType].find(value => String(value ?? "").toLowerCase().includes("story"))
    ?? [item.item_type, item.type, item.mediaType, item.productType].find(value => String(value ?? "").toLowerCase().includes("highlight"))
    ?? item.mediaType ?? item.item_type ?? item.type ?? item.productType ?? "post";
  const mediaType = String(rawType).toLowerCase();
  const normalizedType: InstagramMediaOrigin = mediaType.includes("highlight") ? "highlight" : mediaType.includes("story") ? "story" : "post";
  const isVideo = mediaType.includes("video") || mediaType.includes("reel") || String(item.media_type ?? "").toLowerCase().includes("video") || item.isVideo === true;
  const mediaUrl = String(item.mediaUrl ?? item.media_url ?? item.displayUrl ?? item.display_url ?? item.imageUrl ?? item.image_url ?? item.image_url ?? item.videoUrl ?? item.video_url ?? item.url ?? "");
  const thumbnailUrl = String(item.thumbnailUrl ?? item.thumbnail_url ?? item.imageUrl ?? item.image_url ?? "");
  const imageUrl = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;
  const owner = item.owner && typeof item.owner === "object" ? item.owner as Record<string, unknown> : undefined;
  const highlight = item.highlight && typeof item.highlight === "object" ? item.highlight as Record<string, unknown> : undefined;
  const username = String(item.source_username ?? item.ownerUsername ?? item.username ?? owner?.username ?? fallbackUsername);
  const highlightTitle = String(item.highlightTitle ?? item.highlight_title ?? highlight?.title ?? item.title ?? "");
  if (!imageUrl && !item.caption && !item.text) return null;
  if (normalizedType === "highlight" && !isAgendaHighlightTitle(highlightTitle)) return null;
  return {
    id: item.id ? String(item.id) : undefined,
    shortCode: item.shortCode ? String(item.shortCode) : undefined,
    url: item.url ? String(item.url) : username ? `https://www.instagram.com/${username.replace(/^@/, "")}/` : undefined,
    permalink: item.permalink ? String(item.permalink) : undefined,
    caption: item.caption ? String(item.caption) : undefined,
    text: item.text ? String(item.text) : undefined,
    timestamp: typeof (item.timestamp ?? item.postedAt ?? item.taken_at) === "number" || typeof (item.timestamp ?? item.postedAt ?? item.taken_at) === "string" ? (item.timestamp ?? item.postedAt ?? item.taken_at) as string | number : undefined,
    takenAt: typeof (item.takenAt ?? item.taken_at) === "number" || typeof (item.takenAt ?? item.taken_at) === "string" ? (item.takenAt ?? item.taken_at) as string | number : undefined,
    postedAt: typeof (item.postedAt ?? item.taken_at) === "number" || typeof (item.postedAt ?? item.taken_at) === "string" ? (item.postedAt ?? item.taken_at) as string | number : undefined,
    expiresAt: typeof (item.expiresAt ?? item.expiring_at) === "number" || typeof (item.expiresAt ?? item.expiring_at) === "string" ? (item.expiresAt ?? item.expiring_at) as string | number : undefined,
    displayUrl: imageUrl || undefined,
    imageUrl: imageUrl || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    thumbnail_url: thumbnailUrl || undefined,
    isVideo,
    ownerUsername: username || undefined,
    username: username || undefined,
    sourceKey: item.sourceKey ? String(item.sourceKey) : undefined,
    mediaType: normalizedType,
    highlightTitle: highlightTitle || undefined,
    ocrText: item.ocrText ? String(item.ocrText) : item.accessibility_caption ? String(item.accessibility_caption) : undefined,
  };
}

type MediaNormalizationContext = { username?: string; mediaType?: InstagramMediaOrigin; highlightTitle?: string };

function mediaTypeFromKey(key: string): InstagramMediaOrigin | undefined {
  const normalized = key.toLowerCase();
  if (normalized.includes("highlight")) return "highlight";
  if (normalized.includes("stor")) return "story";
  return undefined;
}

function collectInstagramMediaCandidates(value: unknown, context: MediaNormalizationContext = {}, depth = 0): InstagramPost[] {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap(item => collectInstagramMediaCandidates(item, context, depth + 1));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const owner = record.owner && typeof record.owner === "object" ? record.owner as Record<string, unknown> : undefined;
  const highlight = record.highlight && typeof record.highlight === "object" ? record.highlight as Record<string, unknown> : undefined;
  const username = String(record.ownerUsername ?? record.username ?? owner?.username ?? context.username ?? "");
  const highlightTitle = String(record.highlightTitle ?? highlight?.title ?? context.highlightTitle ?? "");
  const rawExplicitType = [record.type, record.mediaType, record.productType].find(value => String(value ?? "").toLowerCase().includes("story"))
    ?? [record.type, record.mediaType, record.productType].find(value => String(value ?? "").toLowerCase().includes("highlight"))
    ?? record.mediaType ?? record.type ?? record.productType ?? "";
  const explicitType = String(rawExplicitType).toLowerCase();
  const mediaType: InstagramMediaOrigin = explicitType.includes("highlight") ? "highlight" : explicitType.includes("story") ? "story" : context.mediaType ?? "post";
  const isVideo = explicitType.includes("video") || explicitType.includes("reel") || record.isVideo === true;
  const preferredMediaUrl = isVideo
    ? record.thumbnailUrl ?? record.thumbnail_url ?? record.mediaUrl ?? record.media_url
    : record.mediaUrl ?? record.media_url ?? record.displayUrl ?? record.display_url ?? record.imageUrl ?? record.image_url ?? record.thumbnailUrl ?? record.thumbnail_url;
  const normalizedRecord: Record<string, unknown> = {
    ...record,
    ownerUsername: username || undefined,
    mediaType,
    highlightTitle: highlightTitle || undefined,
    displayUrl: isVideo ? preferredMediaUrl : record.displayUrl ?? record.display_url ?? record.imageUrl ?? record.image_url ?? preferredMediaUrl,
    imageUrl: isVideo ? preferredMediaUrl : record.imageUrl ?? record.image_url ?? record.displayUrl ?? record.display_url ?? preferredMediaUrl,
    url: record.url ?? record.permalink ?? record.sourceUrl,
  };
  const direct = normalizeInstagramMediaItem(normalizedRecord, username);
  const children: InstagramPost[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (["owner", "highlight"].includes(key) || child === value) continue;
    const childType = mediaTypeFromKey(key);
    children.push(...collectInstagramMediaCandidates(child, { username, mediaType: childType ?? mediaType, highlightTitle: highlightTitle || undefined }, depth + 1));
  }
  return [...(direct ? [direct] : []), ...children];
}

export function normalizeInstagramMediaPayload(payload: unknown, fallbackUsername = ""): InstagramPost[] {
  const normalized = collectInstagramMediaCandidates(payload, { username: fallbackUsername });
  const seen = new Set<string>();
  return normalized.filter(item => {
    const canonicalUrl = postUrl(item);
    const key = item.id ?? (canonicalUrl || `${item.ownerUsername ?? item.username ?? fallbackUsername}|${item.timestamp ?? item.takenAt ?? item.displayUrl ?? item.imageUrl ?? "unknown"}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type StructuredEvent = {
  title: string;
  summary: string;
  eventDate: string;
  locationName: string;
  address: string;
  city: "Santos" | "Guarujá";
  category: "show" | "balada" | "evento_musical";
  genre: "funk" | "house_eletronica" | "samba_pagode" | "rap_trap";
  priceCents: number;
  imageUrl: string;
  sourceUrl: string;
};

export type StructuredRejectionReason = "invalid_date" | "past_event" | "outside_target_venue" | "invalid_source_url" | "missing_required_field" | "invalid_category" | "invalid_genre";

export type StructuredEventRejection = {
  index: number;
  eventKey: string;
  sourceUrl: string;
  reasons: StructuredRejectionReason[];
  sourceUrlValid: boolean;
  eventDateValid: boolean;
  venueNormalized: string;
  cityNormalized: string;
  eventDateIso: string | null;
};

export type FilteredInstagramStory = {
  id: string;
  username: string;
  mediaOrigin: "story" | "highlight";
  imageUrl: string;
  sourceUrl: string;
  postedAt: string | null;
  expiresAt: string | null;
  ocrText: string;
  rawText: string;
  reasons: string[];
  status: "pending" | "approved";
};

const ALLOWED_CITIES = new Set(["Santos", "Guarujá"]);
const ALLOWED_CATEGORIES = new Set(["show", "balada", "evento_musical"]);
const ALLOWED_GENRES = new Set(["funk", "house_eletronica", "samba_pagode", "rap_trap"]);

function eventDiagnosticKey(event: Partial<StructuredEvent>, index: number) {
  return crypto.createHash("sha256").update(`${event.sourceUrl ?? ""}|${event.eventDate ?? ""}|${event.title ?? ""}|${index}`).digest("hex").slice(0, 16);
}

function normalizeDiagnosticText(value: unknown, maxLength = 120) {
  return String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizedEventDateIso(value: unknown) {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function saoPauloCalendarDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eventCalendarDate(value: unknown, parsed: Date) {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : saoPauloCalendarDate(parsed);
}

export function normalizeStructuredEventDate(value: string) {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00-03:00`);
  return new Date(raw);
}

export function createStructuredEventRejection(event: Partial<StructuredEvent>, index: number, reasons: StructuredRejectionReason[]): StructuredEventRejection {
  return {
    index,
    eventKey: eventDiagnosticKey(event, index),
    sourceUrl: normalizeDiagnosticText(event.sourceUrl, 1000),
    reasons,
    sourceUrlValid: reasons.includes("invalid_source_url") === false,
    eventDateValid: reasons.includes("invalid_date") === false && reasons.includes("past_event") === false,
    venueNormalized: normalizeDiagnosticText(event.locationName),
    cityNormalized: normalizeDiagnosticText(event.city),
    eventDateIso: normalizedEventDateIso(event.eventDate),
  };
}

export function validateStructuredInstagramEvent(event: Partial<StructuredEvent>, activeAliases: string[] = [], now = new Date()): StructuredRejectionReason[] {
  const reasons: StructuredRejectionReason[] = [];
  const requiredFields = [event.title, event.summary, event.eventDate, event.locationName, event.address, event.city, event.category, event.genre, event.sourceUrl];
  if (requiredFields.some(value => typeof value !== "string" || value.trim().length === 0)) reasons.push("missing_required_field");
  const parsedDate = new Date(String(event.eventDate ?? ""));
  if (Number.isNaN(parsedDate.getTime())) reasons.push("invalid_date");
  else if (eventCalendarDate(event.eventDate, parsedDate) < saoPauloCalendarDate(now)) reasons.push("past_event");
  if (!ALLOWED_CITIES.has(String(event.city))) reasons.push("outside_target_venue");
  if (!containsTargetVenue(`${String(event.locationName ?? "")} ${String(event.address ?? "")}`, activeAliases)) reasons.push("outside_target_venue");
  if (typeof event.sourceUrl !== "string" || !isValidInstagramSourceUrl(event.sourceUrl)) reasons.push("invalid_source_url");
  if (!ALLOWED_CATEGORIES.has(String(event.category))) reasons.push("invalid_category");
  if (!ALLOWED_GENRES.has(String(event.genre))) reasons.push("invalid_genre");
  return Array.from(new Set(reasons));
}

export function summarizeStructuredRejections(rejections: StructuredEventRejection[]) {
  return rejections.reduce<Record<string, number>>((summary, rejection) => {
    for (const reason of rejection.reasons) summary[reason] = (summary[reason] ?? 0) + 1;
    return summary;
  }, {});
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function postDate(post: InstagramPost) {
  const value = post.timestamp ?? post.takenAt;
  if (typeof value === "number") return new Date(value > 10_000_000_000 ? value : value * 1000);
  return value ? new Date(value) : null;
}

export function isWithinInstagramLookback(post: InstagramPost, now = new Date()) {
  const date = postDate(post);
  if (!date || Number.isNaN(date.getTime())) return false;
  const cutoff = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return date >= cutoff && date <= now;
}

export function hasRegionalHashtag(text: string) {
  return REGIONAL_HASHTAGS.some(hashtag => text.includes(hashtag));
}

function normalizeAgendaText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Gate inicial deliberadamente permissivo: a OpenAI é a autoridade para
 * classificar relevância, data, cidade e gênero do evento.
 */
export function hasApprovedAgendaText(text: string, _username?: string) {
  return normalizeAgendaText(text).trim().length > 0;
}

function isValidInstagramSourceUrl(value: string) {
  return /^https:\/\/www\.instagram\.com\/(?:p|reel|tv|stories|s)\/[A-Za-z0-9._-]+\/?$/i.test(value)
    || /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/?$/i.test(value);
}

function postUrl(post: InstagramPost) {
  const candidate = post.url ?? post.permalink;
  if (candidate?.startsWith("https://www.instagram.com/")) return candidate;
  if (post.shortCode) return `https://www.instagram.com/p/${post.shortCode}/`;
  return "";
}

const OPENAI_RETRY_DELAYS_MS = [250, 750];

export async function waitForOpenAiRetry(delayMs: number) {
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

async function openAiChat(body: Record<string, unknown>) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
    const responseText = await response.text();
    if (response.status === 429 && attempt < OPENAI_RETRY_DELAYS_MS.length) {
      await waitForOpenAiRetry(OPENAI_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`OpenAI request failed with ${response.status}: ${responseText}`);
  }
}

export async function prepareImageForOcr(imageUrl: string) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:image/")) return imageUrl;
  const response = await fetchExternal(imageUrl, { headers: { Accept: "image/*", "User-Agent": "WeekendVibes/1.0" } }, 8_000, false);
  if (!response.ok) throw new Error(`Instagram image download failed with ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Instagram image returned unsupported content type: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Instagram image download returned an empty body");
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export function isRecoverableOcrRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429") || message.includes("rate_limit_exceeded") || message.includes("Rate limit reached");
}

export function shouldExtractInstagramMediaOcr(post: InstagramPost, caption: string, imageUrl: string) {
  return Boolean(imageUrl) && (post.mediaType === "story" || post.mediaType === "highlight" || !caption.trim());
}

export function resolveInstagramVisualUrl(post: InstagramPost) {
  const thumbnailUrl = String(post.thumbnailUrl ?? post.thumbnail_url ?? "").trim();
  if (post.isVideo && (post.mediaType === "story" || post.mediaType === "highlight") && thumbnailUrl.startsWith("https://")) return thumbnailUrl;
  return String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").trim();
}

export async function extractOcrText(imageUrl: string) {
  if (!imageUrl) return "";
  let imagePayload = "";
  try {
    imagePayload = await prepareImageForOcr(imageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[Instagram OCR] Image unavailable; continuing with caption only:", message);
    try { await recordOperationalAlert({ integration: "ocr", title: "Imagem do Instagram indisponível", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist image alert:", alertError); }
    return "";
  }
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [{ role: "user", content: [
        { type: "text", text: "Transcreva literalmente todo o texto legível desta imagem. Não resuma, não corrija e não invente conteúdo." },
        { type: "image_url", image_url: { url: imagePayload, detail: "high" } },
      ] }],
    });
    return String(result.choices?.[0]?.message?.content ?? "");
  } catch (error) {
    if (isRecoverableOcrRateLimit(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[Instagram OCR] Rate limit reached; continuing with caption only:", message);
      try { await recordOperationalAlert({ integration: "ocr", title: "Limite temporário do OCR", message }); } catch (alertError) { console.warn("[Instagram OCR] Could not persist rate-limit alert:", alertError); }
      return "";
    }
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("ocr", error instanceof Error ? error.message : String(error), { cause: error });
  }
}

function metaPostsFromPayload(payload: unknown, target: (typeof INSTAGRAM_TARGETS)[number]): InstagramPost[] {
  try {
    const parsed = parseMetaBusinessDiscovery(payload);
    return parsed.business_discovery.media.data.map(item => ({
      id: item.id,
      caption: item.caption ?? undefined,
      timestamp: item.timestamp ?? undefined,
      permalink: item.permalink ?? undefined,
      media_url: item.media_url ?? undefined,
      displayUrl: item.media_url ?? undefined,
      ownerUsername: item.username ?? target.username,
      mediaType: "post",
    }));
  } catch (error) {
    throw new InstagramIntegrationFailure("meta", "Meta Graph API retornou payload fora do contrato", { cause: error });
  }
}

type InstagramTransportFailure = { username: string; status: number; kind: "proxy_or_session" | "circuit_open" | "quota" | "actor_timeout"; message: string };
type InstagramProviderIssue = { code: "APIFY_QUOTA_EXCEEDED"; status: 403; message: string };

function logInstagramResponseDiagnostics(input: { username: string; status: number; contentType: string | null; body: string; parsed: boolean; mediaCount: number; maskedHtml: boolean }) {
  if (process.env.INGESTION_VERBOSE_DRY_RUN !== "1") return;
  console.info("[Ingestion dry-run] instagram response", {
    username: input.username,
    status: input.status,
    contentType: input.contentType?.split(";")[0] ?? null,
    bytes: Buffer.byteLength(input.body, "utf8"),
    parsedJson: input.parsed,
    mediaCount: input.mediaCount,
    maskedHtml: input.maskedHtml,
  });
}

async function fetchMetaBusinessDiscoveryPostsDetailed(token: string, accountId: string, options: { dryRun?: boolean } = {}): Promise<{ posts: InstagramPost[]; transportFailures: InstagramTransportFailure[] }> {
  const posts: InstagramPost[] = [];
  const transportFailures: InstagramTransportFailure[] = [];
  const configuredSources = (await listEnabledInstagramSources()) ?? [];
  const configuredHandles = new Set(configuredSources.map(source => source.handle?.replace(/^@/, "").toLowerCase()).filter(Boolean));
  const focusedHandle = process.env.INGESTION_FOCUS_INSTAGRAM?.trim().replace(/^@/, "").toLowerCase();
  const configuredTargets = configuredSources.length ? INSTAGRAM_TARGETS.filter(target => configuredHandles.has(target.username.toLowerCase())) : INSTAGRAM_TARGETS;
  const targets = (focusedHandle ? configuredTargets.filter(target => target.username.toLowerCase() === focusedHandle) : configuredTargets).slice().sort((left, right) => {
    const leftPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === left.username.toLowerCase())?.priority ?? 50;
    const rightPriority = configuredSources.find(source => source.handle?.replace(/^@/, "").toLowerCase() === right.username.toLowerCase())?.priority ?? 50;
    return leftPriority - rightPriority;
  });
  const forceRefresh = process.env.INGESTION_FORCE_INSTAGRAM === "1";
  for (const target of targets) {
    const source = configuredSources.find(item => item.handle?.replace(/^@/, "").toLowerCase() === target.username.toLowerCase());
    if (source && !options.dryRun) {
      const circuit = await allowSourceAttempt(source.sourceKey);
      if (!circuit.allowed) {
        transportFailures.push({ username: target.username, status: 0, kind: "circuit_open", message: "Fonte pausada pelo Circuit Breaker durante o cooldown." });
        continue;
      }
    }
    if (!options.dryRun && !forceRefresh && source?.lastSuccessAt && Date.now() - new Date(source.lastSuccessAt).getTime() < source.frequencyMinutes * 60_000) {
      await markIngestionSourceResult(source.sourceKey, { status: "skipped", message: "Aguardando a próxima janela configurada." });
      continue;
    }
    const fields = `business_discovery.username(${target.username}){username,media.limit(25){id,caption,timestamp,permalink,media_url,media_type}}`;
    const url = `${META_GRAPH_BASE_URL}/${accountId}?${new URLSearchParams({ fields, access_token: token }).toString()}`;
    const response = await fetchExternal(url, { headers: { Accept: "application/json" } }, 12_000, true);
    const responseBody = await readExternalBody(response);
    let parsedBody: unknown = null;
    let parsed = false;
    try { parsedBody = JSON.parse(responseBody); parsed = true; } catch { /* resposta não JSON */ }
    const mediaCount = parsedBody && typeof parsedBody === "object" ? (((parsedBody as { business_discovery?: { media?: { data?: unknown[] } } }).business_discovery?.media?.data) ?? []).length : 0;
    const maskedHtml = /<html|<body|login|checkpoint|challenge/i.test(responseBody.slice(0, 1200));
    logInstagramResponseDiagnostics({ username: target.username, status: response.status, contentType: response.headers.get("content-type"), body: responseBody, parsed, mediaCount, maskedHtml });
    if (response.ok && maskedHtml) {
      resetInstagramSessionForRetry("meta_200_masked_session");
      if (source && !options.dryRun) await registerSourceFailure({ sourceKey: source.sourceKey, routine: "instagram-agenda", status: response.status, message: "Resposta HTML mascarada recebida onde era esperado JSON; perfil ignorado nesta tentativa." });
      transportFailures.push({ username: target.username, status: response.status, kind: "proxy_or_session", message: "Resposta mascarada de sessão/proxy; perfil ignorado nesta tentativa." });
      continue;
    }
    if (!response.ok) {
      if (source && !options.dryRun) await markIngestionSourceResult(source.sourceKey, { status: "failed", message: `HTTP ${response.status}` });
      if (isInstagramTransportFailure(response.status, responseBody)) {
        resetInstagramSessionForRetry(`meta_${response.status}`);
        if (source && !options.dryRun) await registerSourceFailure({ sourceKey: source.sourceKey, routine: "instagram-agenda", status: response.status, message: `Meta respondeu HTTP ${response.status}; perfil ignorado nesta tentativa.` });
        transportFailures.push({ username: target.username, status: response.status, kind: "proxy_or_session", message: `Meta respondeu HTTP ${response.status}; perfil ignorado nesta tentativa.` });
        continue;
      }
      throw new InstagramIntegrationFailure("meta", `Meta Graph API request failed with ${response.status}: ${responseBody}`);
    }
    posts.push(...metaPostsFromPayload(parsedBody ?? JSON.parse(responseBody), target));
    if (source && !options.dryRun) {
      await registerSourceSuccess(source.sourceKey);
      await markIngestionSourceResult(source.sourceKey, { status: "succeeded", message: "Business Discovery respondeu com sucesso." });
    }
  }
  return { posts, transportFailures };
}

export const DEFAULT_APIFY_SYNC_TIMEOUT_MS = 20_000;

export function getApifySyncTimeoutMs() {
  const configured = Number.parseInt(process.env.APIFY_SYNC_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_APIFY_SYNC_TIMEOUT_MS;
  return Math.min(30_000, Math.max(15_000, configured));
}

function isAbortTimeout(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted|timeout|timed out|tempo limite/i.test(error.message));
}

export async function fetchApifyStoriesAndHighlights(options: { dryRun?: boolean } = {}) {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return { posts: [] as InstagramPost[], transportFailures: [] as InstagramTransportFailure[] };
  const payload = buildInstagramScraperPayload(INSTAGRAM_TARGETS);
  try {
    const timeoutMs = getApifySyncTimeoutMs();
    const response = await fetchExternal(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "WeekendVibes/1.0" }, body: JSON.stringify(payload) }, timeoutMs, true);
    const body = await readExternalBody(response);
    if (!response.ok) {
      let providerMessage = "";
      try {
        const parsedError = JSON.parse(body) as { error?: { message?: unknown } };
        providerMessage = typeof parsedError.error?.message === "string" ? parsedError.error.message : "";
      } catch {
        providerMessage = "";
      }
      const detail = normalizeDiagnosticText(providerMessage).slice(0, 180);
      const quotaExceeded = response.status === 403 && /monthly usage hard limit|quota|usage limit|limit exceeded/i.test(detail);
      const actorTimedOut = [408, 504].includes(response.status) || /timeout|timed out|tempo limite/i.test(detail);
      const message = quotaExceeded
        ? "Cota mensal do Apify excedida; renove a quota ou injete um token com limite disponível."
        : actorTimedOut
          ? `Timeout de conexão com o coletor Apify (HTTP ${response.status}) após ${getApifySyncTimeoutMs()} ms.`
          : `Apify respondeu HTTP ${response.status}${detail ? `: ${detail}` : "."}`;
      return { posts: [] as InstagramPost[], providerIssue: quotaExceeded ? { code: "APIFY_QUOTA_EXCEEDED" as const, status: 403 as const, message } : undefined, transportFailures: [{ username: "apify-collector", status: response.status, kind: quotaExceeded ? "quota" as const : actorTimedOut ? "actor_timeout" as const : "proxy_or_session" as const, message }] };
    }
    const parsed = JSON.parse(body) as unknown;
    const configuredSources = (await listEnabledInstagramSources()) ?? [];
    const sourceByHandle = new Map(configuredSources.map(source => [String(source.handle ?? "").replace(/^@/, "").toLowerCase(), source.sourceKey]));
    const allowedHandles = configuredSources.length > 0 ? sourceByHandle : new Map(INSTAGRAM_TARGETS.map(target => [target.username.toLowerCase(), `instagram:${target.username}`]));
    const posts = normalizeInstagramMediaPayload(parsed)
      .filter((post: InstagramPost) => post.mediaType === "story" || post.mediaType === "highlight")
      .filter((post: InstagramPost) => allowedHandles.has(String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").toLowerCase()))
      .map((post: InstagramPost) => ({
        ...post,
        sourceKey: allowedHandles.get(String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").toLowerCase()),
      }));
    if (posts.length === 0) {
      const diagnostic = "Apify respondeu HTTP 200, mas nenhum Story/Destaque parseável foi encontrado no payload.";
      console.warn("[Instagram Stories]", diagnostic, { topLevelKeys: parsed && typeof parsed === "object" ? Object.keys(parsed as Record<string, unknown>).slice(0, 20) : [] });
      return { posts, transportFailures: [{ username: "apify-instagram", status: response.status, kind: "proxy_or_session" as const, message: diagnostic }] };
    }
    return { posts, transportFailures: [] as InstagramTransportFailure[] };
  } catch (error) {
    const timedOut = isAbortTimeout(error);
    const message = timedOut
      ? `Timeout de conexão com o coletor Apify após ${getApifySyncTimeoutMs()} ms.`
      : normalizeDiagnosticText(error instanceof Error ? error.message : error) || "Falha ao consultar o scraper de Stories.";
    return { posts: [] as InstagramPost[], transportFailures: [{ username: "apify-collector", status: 0, kind: timedOut ? "actor_timeout" as const : "proxy_or_session" as const, message }] };
  }
}

export async function fetchInstagramPostsDetailed(options: { dryRun?: boolean } = {}) {
  const token = requiredEnv("META_INSTAGRAM_TOKEN");
  const accountId = requiredEnv("META_INSTAGRAM_ACCOUNT_ID");
  const meta = await fetchMetaBusinessDiscoveryPostsDetailed(token, accountId, options);
  const supplemental = await fetchApifyStoriesAndHighlights(options);
  return { posts: [...meta.posts, ...supplemental.posts], transportFailures: [...meta.transportFailures, ...supplemental.transportFailures] };
}

export async function fetchInstagramPosts() {
  const result = await fetchInstagramPostsDetailed();
  return result.posts;
}

/**
 * Business Discovery expõe mídia publicada, não Stories de perfis de terceiros.
 * O retorno vazio é deliberado: não usamos scraping de sessão nem endpoints
 * privados e não fabricamos eventos quando Stories não estão disponíveis.
 */
export async function fetchInstagramStories(): Promise<InstagramPost[]> {
  const result = await fetchApifyStoriesAndHighlights({ dryRun: true });
  return result.posts.filter(post => post.mediaType === "story");
}

export function createMeuLugarSandboxStoryMock(referenceDate = getInstagramReferenceDate()): InstagramPost {
  return {
    id: "sandbox-meulugar-story-1",
    url: "https://www.instagram.com/stories/meulugar.bar/1234567890/",
    ownerUsername: "meulugar.bar",
    username: "meulugar.bar",
    mediaType: "story",
    displayUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    timestamp: `${referenceDate}T12:00:00-03:00`,
    ocrText: `Meu Lugar Bar — Programação especial\n${referenceDate}\n22h\nAtrações: DJs convidados\nSantos`,
  };
}

function deduplicateInstagramPosts(posts: InstagramPost[]) {
  const seen = new Set<string>();
  return posts.filter(post => {
    const key = post.id ?? postUrl(post) ?? `${post.ownerUsername ?? post.username ?? "unknown"}|${post.timestamp ?? post.takenAt ?? "unknown"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractStructuredEvents(referenceDate: string, approvedPosts: Array<{ post: InstagramPost; rawText: string }>) {
  if (approvedPosts.length === 0) return [] as StructuredEvent[];
  const raw = approvedPosts.map(({ post, rawText }) => `SOURCE_URL: ${postUrl(post)}\nACCOUNT: ${post.ownerUsername ?? post.username ?? ""}\nMEDIA_ORIGIN: ${post.mediaType ?? "post"}${post.highlightTitle ? `\nHIGHLIGHT_TITLE: ${post.highlightTitle}` : ""}\nRAW_POST_TEXT: ${rawText}`).join("\n\n").slice(0, 48_000);
  try {
    const result = await openAiChat({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: `Extraia somente eventos futuros de fim de semana, públicos e musicais, localizados exclusivamente em Santos ou Guarujá. Data de Referência: ${referenceDate}. Ignore rigorosamente qualquer postagem ou evento que se refira a data anterior à Data de Referência; não tente inferir datas passadas como futuras. A data mínima aceita é ${referenceDate}. Para MEDIA_ORIGIN story ou highlight, trate RAW_POST_TEXT como OCR da arte gráfica e extraia Nome do Evento, Data, Horário e Atrações somente do texto reconhecido. Se a legenda informar dia e mês, mas omitir o ano, infira o ano atual ou futuro que torne a data válida a partir da Data de Referência; nunca use um ano passado por padrão. Retorne eventDate em ISO 8601. Use apenas informações presentes no texto bruto. Se data, cidade, endereço ou gênero não forem verificáveis, descarte o evento. Normalize category para show, balada ou evento_musical e genre para funk, house_eletronica, samba_pagode ou rap_trap. Não invente preços; use 0 quando o texto não informar preço.` },
        { role: "user", content: raw },
      ],
      response_format: { type: "json_schema", json_schema: { name: "instagram_weekend_events", strict: true, schema: {
        type: "object", properties: { events: { type: "array", items: { type: "object", properties: {
          title: { type: "string" }, summary: { type: "string" }, eventDate: { type: "string" }, locationName: { type: "string" }, address: { type: "string" }, city: { type: "string", enum: ["Santos", "Guarujá"] }, category: { type: "string", enum: ["show", "balada", "evento_musical"] }, genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] }, priceCents: { type: "integer" }, imageUrl: { type: "string" }, sourceUrl: { type: "string" },
        }, required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "genre", "priceCents", "imageUrl", "sourceUrl"], additionalProperties: false } } }, required: ["events"], additionalProperties: false,
      } } },
    });
    const content = result.choices?.[0]?.message?.content ?? "{\"events\":[]}";
    return (JSON.parse(content) as { events: StructuredEvent[] }).events;
  } catch (error) {
    if (error instanceof InstagramIntegrationFailure) throw error;
    throw new InstagramIntegrationFailure("openai", error instanceof Error ? error.message : String(error), { cause: error });
  }
}

export type InstagramPipelineOptions = { dryRun?: boolean; storiesOnly?: boolean; postsOverride?: InstagramPost[] };

export async function runInstagramPipeline(options: InstagramPipelineOptions = {}) {
  const pipelineStartedAt = Date.now();
  const dryRun = options.dryRun === true;
  const storiesOnly = options.storiesOnly === true;
  const referenceDate = getInstagramReferenceDate();
  if (!dryRun) await recordReferenceDateClockAlert(referenceDate);
  const activeAliases = await listActiveLocationAliasValues();
  const fetched = options.postsOverride
    ? { posts: options.postsOverride, transportFailures: [] as InstagramTransportFailure[] }
    : storiesOnly
      ? await fetchApifyStoriesAndHighlights({ dryRun })
      : await fetchInstagramPostsDetailed({ dryRun });
  const sandboxRestricted = process.env.NODE_ENV !== "production" && fetched.posts.length === 0 && (fetched.transportFailures.length === 0 && storiesOnly ? !process.env.APIFY_API_TOKEN : fetched.transportFailures.length > 0 && fetched.transportFailures.every(failure => failure.status === 0 || failure.status === 403 || failure.status === 502 || failure.status === 503 || failure.status === 504 || isSandboxRestrictedError(new Error(failure.message))));
  if (sandboxRestricted && shouldUseSandboxMocks()) {
    const durationMs = Math.max(1, Date.now() - pipelineStartedAt);
    const meuLugarStory = createMeuLugarSandboxStoryMock(referenceDate);
    const previewMockEvents = [
      { title: "Meu Lugar · Programação especial", eventDate: `${referenceDate}T22:00:00-03:00`, locationName: "Meu Lugar", city: "Santos", source: meuLugarStory.url, mediaOrigin: meuLugarStory.mediaType, imageUrl: meuLugarStory.displayUrl, ocrText: meuLugarStory.ocrText },
      { title: "Preview · Noite na Baixada", eventDate: `${referenceDate}T22:00:00-03:00`, locationName: "Ativa House", city: "Santos" },
      { title: "Preview · Sunset Guarujá", eventDate: `${referenceDate}T18:00:00-03:00`, locationName: "Laroc Club Guarujá", city: "Guarujá" },
      { title: "Preview · House Session", eventDate: `${referenceDate}T23:00:00-03:00`, locationName: "Vallum Garden", city: "Santos" },
    ];
    const providerIssue = "providerIssue" in fetched ? (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue : undefined;
    return {
      dryRun, previewMock: true, sandboxRestricted: true, durationMs, sourceReports: [{ sourceKey: "instagram", durationMs, read: previewMockEvents.length, filtered: 0, persistable: dryRun ? previewMockEvents.length : 0, added: 0, updated: 0, ignored: 0, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 0, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
      previewMockEvents, providerIssue, quotaExceeded: providerIssue?.code === "APIFY_QUOTA_EXCEEDED", ocrAudit: previewMockEvents.map(event => ({ mediaOrigin: event.mediaOrigin ?? "story", imageUrl: String(event.imageUrl ?? "").slice(0, 1000), sourceUrl: String(event.source ?? "").slice(0, 1000), highlightTitle: null, ocrText: String(event.ocrText ?? "").slice(0, 3000), rawText: String(event.ocrText ?? "").slice(0, 5000) })).filter(item => item.imageUrl.startsWith("https://")), receivedPosts: previewMockEvents.length, approvedPosts: previewMockEvents.length, degraded: false, transportFailures: [],
      structuredEvents: previewMockEvents.length, imported: 0, persisted: 0, added: 0, updated: 0, ignored: 0, filtered: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, rejectedEvents: [], rejectionReasons: {}, persistedEventIds: [], dateFilterValidation: { timezone: "America/Sao_Paulo", today: referenceDate, structuredEvents: previewMockEvents.length, pastEventsRejected: 0, acceptedTodayOrFuture: previewMockEvents.length },
    };
  }
  const posts = deduplicateInstagramPosts(fetched.posts);
  const approvedPosts: Array<{ post: InstagramPost; rawText: string }> = [];
  const ocrAuditCandidates: Array<{ post: InstagramPost; rawText: string }> = [];
  const forceFocusedRun = process.env.INGESTION_FORCE_INSTAGRAM === "1";
  for (const post of posts) {
    if (!forceFocusedRun && !isWithinInstagramLookback(post)) continue;
    const caption = String(post.caption ?? post.text ?? "");
    const postUsername = post.ownerUsername ?? post.username;
    const imageUrl = resolveInstagramVisualUrl(post);
    const isVisualMedia = post.mediaType === "story" || post.mediaType === "highlight";
    let ocrText = post.ocrText?.trim() ?? "";
    if (shouldExtractInstagramMediaOcr(post, caption, imageUrl) && !ocrText) {
      try {
        ocrText = await extractOcrText(imageUrl);
      } catch (error) {
        const message = normalizeDiagnosticText(error instanceof Error ? error.message : error, 240);
        console.warn("[Instagram OCR] Falha por mídia; continuando o processamento do lote", { mediaOrigin: post.mediaType ?? "post", sourceUrl: postUrl(post), message });
        try {
          await recordOperationalAlert({ integration: "ocr", title: "Falha ao processar OCR de mídia", message: `Mídia ${post.mediaType ?? "post"} não processada: ${message}` });
        } catch (alertError) {
          console.warn("[Instagram OCR] Could not persist media OCR alert:", alertError);
        }
      }
    }
    const rawText = [caption, ocrText].filter(value => value.trim()).join("\n");
    if (isVisualMedia || ocrText) ocrAuditCandidates.push({ post, rawText });
    const regionalMarker = hasRegionalHashtag(rawText) ? "\nREGIONAL_HASHTAG_MATCH: Santos/Guarujá" : "";
    if (rawText.trim()) approvedPosts.push({ post, rawText: `${rawText}${regionalMarker}` });
  }

  const structuredEvents = await extractStructuredEvents(referenceDate, approvedPosts);
  const mediaOriginBySourceUrl = new Map(approvedPosts.map(({ post }) => [postUrl(post), post.mediaType ?? "post"]));
  let imported = 0;
  let added = 0;
  let updated = 0;
  let ignored = 0;
  let duplicates = 0;
  let missingCoordinates = 0;
  const rejectedEvents: StructuredEventRejection[] = [];
  const persistedEventIds: number[] = [];
  for (let index = 0; index < structuredEvents.length; index += 1) {
    const event = structuredEvents[index];
    const reasons = validateStructuredInstagramEvent(event, activeAliases);
    if (reasons.length > 0) {
      rejectedEvents.push(createStructuredEventRejection(event, index, reasons));
      continue;
    }
    const eventDate = normalizeStructuredEventDate(event.eventDate);
    const coordinates = await resolveRegionalCoordinates({ locationName: event.locationName, address: event.address, city: event.city });
    const sourceUrl = event.sourceUrl;
    const mediaOrigin = mediaOriginBySourceUrl.get(sourceUrl) ?? "post";
    const sourceType = mediaOrigin === "story" ? "instagram_story" : mediaOrigin === "highlight" ? "instagram_highlight" : INSTAGRAM_AGENDA_SOURCE_TYPE;
    const sourceHash = crypto.createHash("md5").update(`${sourceUrl}|${eventDate.toISOString().slice(0, 10)}|${event.title}`).digest("hex");
    const saved = dryRun ? { created: true, id: undefined, updated: false } : await saveEvent({
      title: event.title, slug: `${event.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${eventDate.getTime()}`,
      description: event.summary, eventDate, locationName: event.locationName, address: event.address, city: event.city,
      category: event.category, genre: event.genre, priceCents: event.priceCents || 0, priceNote: event.priceCents ? undefined : "Preço não informado na agenda do Instagram",
      ticketStatus: event.priceCents ? "available" : "unknown", sourceUrl, imageUrl: event.imageUrl || undefined, latitude: coordinates?.latitude, longitude: coordinates?.longitude,
      neighborhood: coordinates?.neighborhood ?? undefined, formattedAddress: coordinates?.formattedAddress ?? undefined, locationPrecision: coordinates ? (coordinates.confidence === "low" ? "approximate" : "exact") : undefined,
      sourceHash, sourceType, isPublished: 1, isArchived: 0,
    });
    if (!saved || typeof saved !== "object" || saved.created) added += 1;
    else if (saved.updated) updated += 1;
    else { duplicates += 1; ignored += 1; }
    if (saved?.id) persistedEventIds.push(saved.id);
    if (!coordinates) missingCoordinates += 1;
    imported += 1;
  }
  const rejectionReasons = summarizeStructuredRejections(rejectedEvents);
  const persistedCount = dryRun ? approvedPosts.length : added + updated;
  const filteredCount = Math.max(0, posts.length - persistedCount);
  const explicitFilteredCount = Object.entries(rejectionReasons).reduce((sum, [reason, count]) => reason === "fetch_failed" ? sum : sum + Math.max(0, Number(count) || 0), 0);
  if (filteredCount > explicitFilteredCount) rejectionReasons.unclassified_filtered = filteredCount - explicitFilteredCount;
  const acceptedSourceUrls = new Set(structuredEvents.filter((event, index) => validateStructuredInstagramEvent(event, activeAliases).length === 0).map(event => event.sourceUrl));
  const rejectedBySourceUrl = new Map(rejectedEvents.map(rejection => [rejection.sourceUrl, rejection.reasons]));
  const filteredStories: FilteredInstagramStory[] = ocrAuditCandidates
    .filter(({ post }) => !acceptedSourceUrls.has(postUrl(post)))
    .map(({ post, rawText }, index) => {
      const sourceUrl = postUrl(post);
      const reasons = rejectedBySourceUrl.get(sourceUrl) ?? (rawText.trim() ? ["Não gerou evento estruturado aprovado"] : ["Sem texto suficiente para extração"]);
      const username = String(post.ownerUsername ?? post.username ?? "").replace(/^@/, "").trim().slice(0, 160);
      const imageUrl = String(post.displayUrl ?? post.imageUrl ?? post.media_url ?? "").trim().slice(0, 1000);
      const postedAt = typeof post.postedAt === "string" ? post.postedAt.slice(0, 40) : null;
      const expiresAt = typeof post.expiresAt === "string" ? post.expiresAt.slice(0, 40) : null;
      const mediaOrigin: FilteredInstagramStory["mediaOrigin"] = post.mediaType === "highlight" ? "highlight" : "story";
      return { id: `${username}:${sourceUrl || imageUrl}:${postedAt ?? index}`.slice(0, 500), username, mediaOrigin, imageUrl, sourceUrl, postedAt, expiresAt, ocrText: String(post.ocrText ?? "").slice(0, 3000), rawText: rawText.slice(0, 5000), reasons: reasons.map(reason => String(reason).slice(0, 160)), status: "pending" as const };
    })
    .filter(item => item.imageUrl.startsWith("https://"));
  const sourceReports = [{
    sourceKey: "instagram",
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    read: posts.length,
    filtered: filteredCount,
    persistable: dryRun ? imported : added + updated,
    added: dryRun ? 0 : added,
    updated: dryRun ? 0 : updated,
    ignored: dryRun ? 0 : ignored,
    duplicates,
    errors: fetched.transportFailures.map(failure => ({ sourceUrl: `@${failure.username}`, status: failure.status || null, message: failure.message })),
    rejectionReasons: {
      fetchFailed: fetched.transportFailures.length,
      outsideTargetVenue: Number(rejectionReasons.outside_target_venue ?? 0),
      invalidStructuredEvent: Number(rejectionReasons.invalid_date ?? 0) + Number(rejectionReasons.invalid_source_url ?? 0) + Number(rejectionReasons.missing_required_field ?? 0) + Number(rejectionReasons.invalid_category ?? 0) + Number(rejectionReasons.invalid_genre ?? 0),
      duplicate: duplicates,
      pastEvent: Number(rejectionReasons.past_event ?? 0),
      other: Number(rejectionReasons.unclassified_filtered ?? 0),
    },
  }];
  return {
    dryRun,
    durationMs: Math.max(0, Date.now() - pipelineStartedAt),
    sourceReports,
    receivedPosts: posts.length,
    approvedPosts: approvedPosts.length,
    degraded: fetched.transportFailures.length > 0,
    providerIssue: "providerIssue" in fetched ? (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue : undefined,
    quotaExceeded: "providerIssue" in fetched && (fetched as { providerIssue?: InstagramProviderIssue }).providerIssue?.code === "APIFY_QUOTA_EXCEEDED",
    transportFailures: fetched.transportFailures,
    ocrAudit: buildOcrAuditEntries(ocrAuditCandidates),
    filteredStories,

    structuredEvents: structuredEvents.length,
    imported,
    persisted: persistedCount,
    added: dryRun ? 0 : added,
    updated: dryRun ? 0 : updated,
    ignored: dryRun ? 0 : ignored,
    filtered: filteredCount,
    duplicates,
    missingCoordinates,
    outOfBoundsCoordinates: 0,
    rejectedEvents,
    rejectionReasons,
    persistedEventIds,
    dateFilterValidation: {
      timezone: "America/Sao_Paulo",
      today: saoPauloCalendarDate(new Date()),
      structuredEvents: structuredEvents.length,
      pastEventsRejected: rejectionReasons.past_event ?? 0,
      acceptedTodayOrFuture: Math.max(0, structuredEvents.length - (rejectionReasons.past_event ?? 0)),
    },
  };
}
```

## Fila de Revisão Manual — client/src/components/ManualReviewPanel.tsx

**Caminho:** `client/src/components/ManualReviewPanel.tsx`

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Copy, Edit3, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ManualReviewStatus = "pending" | "approved" | "rejected";
type ManualReviewCategory = "show" | "balada" | "evento_musical";

type ManualReviewEvent = {
  id: number;
  sourceUrl: string | null;
  sourceType: string | null;
  title: string;
  summary: string | null;
  eventDate: string | null;
  endDate: string | null;
  locationName: string | null;
  address: string | null;
  city: string | null;
  category: ManualReviewCategory | null;
  genre: string | null;
  priceCents: number | null;
  imageUrl: string | null;
  rawText: string | null;
  reason: string;
  status: ManualReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedEventId: number | null;
  createdAt: string;
  updatedAt: string;
};

type ManualReviewDraft = {
  title: string;
  eventDate: string;
  endDate: string;
  locationName: string;
  address: string;
  city: "" | "Santos" | "Guarujá";
  category: "" | ManualReviewCategory;
  genre: string;
  summary: string;
  priceCents: string;
  sourceUrl: string;
  sourceType: string;
  imageUrl: string;
  rawText: string;
  reason: string;
};

const PAGE_SIZES = [10, 25, 50] as const;

function readUrlValue(key: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function validStatus(value: string): value is ManualReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date)
    : "Data inválida";
}

function sourceLabel(sourceType: string | null) {
  if (!sourceType) return "Origem não informada";
  return sourceType === "instagram" ? "Instagram" : sourceType === "public" ? "Agenda pública" : sourceType;
}

function statusLabel(status: ManualReviewStatus) {
  return status === "pending" ? "Aguardando revisão" : status === "approved" ? "Publicado" : "Rejeitado";
}

function statusClass(status: ManualReviewStatus) {
  return status === "pending" ? "bg-amber-300/15 text-amber-100" : status === "approved" ? "bg-emerald-300/15 text-emerald-100" : "bg-red-300/15 text-red-100";
}

const RAW_TEXT_HIGHLIGHT_PATTERN = /(^|[^A-Za-zÀ-ÿ0-9])((?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)|(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?|(?:amanhã|amanha|hoje)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?![A-Za-zÀ-ÿ0-9])/gi;

export type RawTextTokenKind = "time" | "date";
export type RawTextToken = { value: string; kind: RawTextTokenKind };
export type RawTextHighlightOptions = {
  onTokenClick?: (token: RawTextToken) => void;
  onApplyToken?: (token: RawTextToken) => void;
  copiedToken?: string | null;
  appliedToken?: string | null;
};

function tokenKind(value: string): RawTextTokenKind {
  return /^(?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)$/i.test(value) ? "time" : "date";
}

export function highlightRawText(text: string, options: RawTextHighlightOptions = {}): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  RAW_TEXT_HIGHLIGHT_PATTERN.lastIndex = 0;
  while ((match = RAW_TEXT_HIGHLIGHT_PATTERN.exec(text)) !== null) {
    const prefixLength = match[0].length - match[2].length;
    const token: RawTextToken = { value: match[2], kind: tokenKind(match[2]) };
    nodes.push(<React.Fragment key={`text-${index}`}>{text.slice(cursor, match.index + prefixLength)}</React.Fragment>);
    if (!options.onTokenClick) {
      nodes.push(<mark key={`highlight-${index}`} className="rounded bg-amber-300/25 px-1 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">{token.value}</mark>);
    } else {
      nodes.push(
        <span key={`interactive-highlight-${index}`} className="mx-0.5 inline-flex items-center align-baseline rounded bg-amber-300/25 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">
          <button type="button" onClick={() => options.onTokenClick?.(token)} aria-label={`Copiar ${token.value}`} title="Copiar este valor" className="rounded-l px-1 font-bold underline decoration-dotted underline-offset-2 hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">{token.value}</button>
          {options.onApplyToken && <button type="button" onClick={() => options.onApplyToken?.(token)} aria-label={`Aplicar ${token.value} ao formulário`} title="Aplicar ao formulário" className="rounded-r border-l border-amber-200/20 px-1.5 text-xs font-black hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">+</button>}
          {options.copiedToken === token.value && <span role="status" className="sr-only">Copiado!</span>}
          {options.appliedToken === token.value && <span role="status" className="sr-only">Aplicado!</span>}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
    index += 1;
  }
  nodes.push(<React.Fragment key={`text-${index}`}>{text.slice(cursor)}</React.Fragment>);
  return nodes;
}

export function applyRawTokenToDateTime(currentValue: string, token: RawTextToken, fallbackDate?: string): string | null {
  const datePart = currentValue.slice(0, 10) || fallbackDate || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (token.kind === "time") {
    const timeMatch = token.value.match(/^(\d{1,2})(?::|h)(\d{2})?$/i);
    if (!timeMatch || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    if (!Number.isInteger(hours) || hours > 23 || minutes > 59) return null;
    return `${datePart}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const dateMatch = token.value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!dateMatch) return null;
  const currentYear = datePart.slice(0, 4);
  const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear;
  if (!/^\d{4}$/.test(year)) return null;
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}${currentValue.slice(10) || "T00:00"}`;
}

export function draftFromEvent(event: ManualReviewEvent): ManualReviewDraft {
  return {
    title: event.title,
    eventDate: toDateTimeLocal(event.eventDate),
    endDate: toDateTimeLocal(event.endDate),
    locationName: event.locationName ?? "",
    address: event.address ?? "",
    city: event.city === "Santos" || event.city === "Guarujá" ? event.city : "",
    category: event.category ?? "",
    genre: event.genre ?? "",
    summary: event.summary ?? "",
    priceCents: event.priceCents == null ? "" : String(event.priceCents),
    sourceUrl: event.sourceUrl ?? "",
    sourceType: event.sourceType ?? "",
    imageUrl: event.imageUrl ?? "",
    rawText: event.rawText ?? "",
    reason: event.reason,
  };
}

export default function ManualReviewPanel() {
  const [status, setStatus] = useState<"" | ManualReviewStatus>(() => { const value = readUrlValue("manual_review_status"); return validStatus(value) ? value : ""; });
  const [sourceType, setSourceType] = useState(() => readUrlValue("manual_review_source"));
  const [from, setFrom] = useState(() => readUrlValue("manual_review_from"));
  const [to, setTo] = useState(() => readUrlValue("manual_review_to"));
  const [pageSize, setPageSize] = useState(() => { const value = Number(readUrlValue("manual_review_page_size")); return PAGE_SIZES.includes(value as typeof PAGE_SIZES[number]) ? value : 25; });
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<ManualReviewEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [draft, setDraft] = useState<ManualReviewDraft | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [appliedToken, setAppliedToken] = useState<string | null>(null);

  const listInput = useMemo(() => ({ status: status || undefined, sourceType: sourceType.trim() || undefined, from: from || undefined, to: to || undefined, offset: page * pageSize, limit: pageSize }), [status, sourceType, from, to, page, pageSize]);
  const queueQuery = trpc.adminRoutine.manualReview.list.useQuery(listInput, { refetchInterval: 30_000 });
  const metricsQuery = trpc.adminRoutine.manualReview.metrics.useQuery(undefined, { refetchInterval: 30_000 });
  const updateMutation = trpc.adminRoutine.manualReview.update.useMutation({
    onSuccess: updated => {
      setSelectedEvent(updated);
      setDraft(draftFromEvent(updated));
      sonnerToast.success("Revisão salva", { description: "Os dados assistidos foram atualizados." });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível salvar a revisão", { description: friendlyAdminErrorMessage(error, "Revise os campos e tente novamente.") }),
  });
  const approveMutation = trpc.adminRoutine.manualReview.approve.useMutation({
    onSuccess: approved => {
      setSelectedEvent(approved);
      setDraft(draftFromEvent(approved));
      showUndoToast(approved.id, "Evento publicado");
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível publicar", { description: friendlyAdminErrorMessage(error, "Preencha data, local, cidade e categoria antes de aprovar.") }),
  });
  const approveManyMutation = trpc.adminRoutine.manualReview.approveMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(id)));
      sonnerToast.success("Eventos publicados", { description: `${result.count} evento(s) foram aprovados e publicados.`, duration: 8_000, action: { label: "Desfazer", onClick: () => undoManyMutation.mutate({ ids: result.ids }) } });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível aprovar em massa", { description: friendlyAdminErrorMessage(error, "Complete os campos obrigatórios dos eventos selecionados.") }),
  });
  const rejectManyMutation = trpc.adminRoutine.manualReview.rejectMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(id)));
      sonnerToast.success("Eventos rejeitados", { description: `${result.count} evento(s) foram removidos da fila de revisão.`, duration: 8_000, action: { label: "Desfazer", onClick: () => undoManyMutation.mutate({ ids: result.ids }) } });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível rejeitar em massa", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });
  const rejectMutation = trpc.adminRoutine.manualReview.reject.useMutation({
    onSuccess: rejected => {
      setSelectedEvent(rejected);
      setDraft(draftFromEvent(rejected));
      showUndoToast(rejected.id, "Evento rejeitado");
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível rejeitar", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });
  const undoMutation = trpc.adminRoutine.manualReview.undo.useMutation({
    onSuccess: restored => {
      setSelectedEvent(restored);
      setDraft(draftFromEvent(restored));
      sonnerToast.success("Ação desfeita", { description: "O evento voltou para a fila de revisão manual." });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível desfazer", { description: friendlyAdminErrorMessage(error, "A ação já pode ter sido revertida ou expirado o prazo.") }),
  });
  const undoManyMutation = trpc.adminRoutine.manualReview.undoMany.useMutation({
    onSuccess: result => {
      sonnerToast.success("Ações desfeitas", { description: `${result.count} evento(s) voltaram para a fila de revisão.` });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível desfazer em massa", { description: friendlyAdminErrorMessage(error, "Algumas ações já podem ter expirado.") }),
  });
  const showUndoToast = (id: number, message: string) => {
    sonnerToast.success(message, {
      description: "Você pode reverter esta ação rapidamente.",
      duration: 8_000,
      action: { label: "Desfazer", onClick: () => undoMutation.mutate({ id }) },
    });
  };

  useEffect(() => {
    setPage(0);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (status) params.set("manual_review_status", status); else params.delete("manual_review_status");
    if (sourceType.trim()) params.set("manual_review_source", sourceType.trim()); else params.delete("manual_review_source");
    if (from) params.set("manual_review_from", from); else params.delete("manual_review_from");
    if (to) params.set("manual_review_to", to); else params.delete("manual_review_to");
    params.set("manual_review_page_size", String(pageSize));
    window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`);
  }, [status, sourceType, from, to, pageSize]);

  useEffect(() => { setPage(0); }, [status, sourceType, from, to, pageSize]);
  const pendingVisibleIds = useMemo(() => (queueQuery.data?.items ?? []).filter(event => event.status === "pending").map(event => event.id), [queueQuery.data?.items]);
  const pendingVisibleKey = pendingVisibleIds.join(",");
  useEffect(() => { setSelectedIds(current => current.filter(id => pendingVisibleIds.includes(id))); }, [pendingVisibleKey]);
  const allPendingSelected = pendingVisibleIds.length > 0 && pendingVisibleIds.every(id => selectedIds.includes(id));
  const bulkPending = approveManyMutation.isPending || rejectManyMutation.isPending;
  const toggleSelected = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id]);
  const toggleAllPending = () => setSelectedIds(current => allPendingSelected ? current.filter(id => !pendingVisibleIds.includes(id)) : Array.from(new Set([...current, ...pendingVisibleIds])));
  const approveSelectedMany = () => { if (!bulkPending && selectedIds.length > 0) approveManyMutation.mutate({ ids: Array.from(new Set(selectedIds)) }); };
  const rejectSelectedMany = () => { if (!bulkPending && selectedIds.length > 0 && window.confirm(`Rejeitar ${selectedIds.length} evento(s) selecionado(s)? Eles sairão da fila de revisão.`)) rejectManyMutation.mutate({ ids: Array.from(new Set(selectedIds)) }); };

  const selectEvent = (event: ManualReviewEvent) => {
    setSelectedEvent(event);
    setDraft(draftFromEvent(event));
    setCopyState("idle");
    setCopiedToken(null);
    setAppliedToken(null);
  };
  const copyRawText = async () => {
    if (!draft?.rawText) return;
    try {
      await navigator.clipboard.writeText(draft.rawText);
      setCopyState("copied");
      sonnerToast.success("Texto copiado", { description: "O texto original foi copiado para a área de transferência." });
    } catch {
      setCopyState("error");
      sonnerToast.error("Não foi possível copiar", { description: "Selecione o texto manualmente e tente novamente." });
    }
  };
  const copyToken = async (token: RawTextToken) => {
    try {
      await navigator.clipboard.writeText(token.value);
      setCopiedToken(token.value);
      sonnerToast.success("Token copiado", { description: `“${token.value}” foi copiado.` });
    } catch {
      sonnerToast.error("Não foi possível copiar o token", { description: "Selecione o valor manualmente e tente novamente." });
    }
  };
  const setDraftField = <K extends keyof ManualReviewDraft>(key: K, value: ManualReviewDraft[K]) => setDraft(current => current ? { ...current, [key]: value } : current);
  const applyTokenToDraft = (token: RawTextToken) => {
    if (!draft) return;
    const nextEventDate = applyRawTokenToDateTime(draft.eventDate, token);
    if (!nextEventDate) {
      sonnerToast.info("Token não reconhecido para preenchimento", { description: "O valor foi mantido disponível para cópia manual; confirme a data ou horário no formulário." });
      return;
    }
    setDraft(current => current ? { ...current, eventDate: nextEventDate } : current);
    setAppliedToken(token.value);
    sonnerToast.success("Token aplicado", { description: `“${token.value}” foi aplicado à data e hora do evento.` });
  };
  const saveDraft = () => {
    if (!selectedEvent || !draft || updateMutation.isPending) return;
    updateMutation.mutate({
      id: selectedEvent.id,
      title: draft.title,
      eventDate: localDateTimeToIso(draft.eventDate),
      endDate: localDateTimeToIso(draft.endDate),
      locationName: draft.locationName || null,
      address: draft.address || null,
      city: draft.city || null,
      category: draft.category || null,
      genre: draft.genre || null,
      summary: draft.summary || null,
      priceCents: draft.priceCents ? Number(draft.priceCents) : null,
      sourceUrl: draft.sourceUrl || null,
      sourceType: draft.sourceType || null,
      imageUrl: draft.imageUrl || null,
      rawText: draft.rawText || null,
      reason: draft.reason,
    });
  };
  const approveSelected = () => {
    if (!selectedEvent || approveMutation.isPending) return;
    approveMutation.mutate({ id: selectedEvent.id });
  };
  const rejectSelected = () => {
    if (!selectedEvent || rejectMutation.isPending) return;
    rejectMutation.mutate({ id: selectedEvent.id });
  };
  const isSaving = updateMutation.isPending || approveMutation.isPending || rejectMutation.isPending || bulkPending;

  return (
    <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-7" data-testid="manual-review-panel" aria-labelledby="manual-review-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-amber-200" /><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Governança de eventos</p></div>
          <h2 id="manual-review-title" className="mt-2 text-2xl font-black text-zinc-100">Fila de Revisão Manual</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Eventos parcialmente estruturados pela IA permanecem aqui para completar os dados com segurança antes da publicação.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { void queueQuery.refetch(); void metricsQuery.refetch(); }} disabled={queueQuery.isFetching || metricsQuery.isFetching} aria-label="Atualizar fila de revisão manual"><RefreshCw size={14} className={queueQuery.isFetching ? "animate-spin" : ""} /> Atualizar</Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="manual-review-metrics">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Eventos publicados</p><p className="mt-2 text-3xl font-black text-emerald-50">{metricsQuery.data?.published ?? "—"}</p><p className="mt-1 text-xs text-zinc-500">Eventos ativos na agenda pública</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Aguardando revisão</p><p className="mt-2 text-3xl font-black text-amber-50">{metricsQuery.data?.awaitingReview ?? "—"}</p><p className="mt-1 text-xs text-zinc-500">Entradas incompletas preservadas pela IA</p></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="manual-review-filters">
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Status<select value={status} onChange={event => setStatus(event.target.value as "" | ManualReviewStatus)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual por status"><option value="">Todos</option><option value="pending">Aguardando revisão</option><option value="approved">Publicados</option><option value="rejected">Rejeitados</option></select></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Fonte/tipo<input value={sourceType} onChange={event => setSourceType(event.target.value)} placeholder="instagram ou public" className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-600" aria-label="Filtrar fila manual por fonte" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Data inicial<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual a partir da data" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Data final<input type="date" value={to} onChange={event => setTo(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual até a data" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Por página<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Tamanho da página da fila manual">{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{queueQuery.data?.total ?? 0} entrada(s) para os filtros atuais</span>{queueQuery.isFetching && <span role="status">Atualizando…</span>}</div>
      {pendingVisibleIds.length > 0 && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="manual-review-bulk-actions"><label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-zinc-200"><input type="checkbox" checked={allPendingSelected} onChange={toggleAllPending} disabled={bulkPending} aria-label="Selecionar todos os eventos pendentes visíveis" className="h-5 w-5 accent-fuchsia-400" /> Selecionar pendentes visíveis <span className="text-zinc-500">({pendingVisibleIds.length})</span></label>{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-fuchsia-100">{selectedIds.length} selecionado(s)</span><Button type="button" size="sm" data-testid="manual-review-approve-many" onClick={approveSelectedMany} disabled={bulkPending} aria-busy={approveManyMutation.isPending} className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200">{approveManyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {approveManyMutation.isPending ? "Publicando…" : "Aprovar selecionados"}</Button><Button type="button" variant="outline" size="sm" data-testid="manual-review-reject-many" onClick={rejectSelectedMany} disabled={bulkPending} aria-busy={rejectManyMutation.isPending} className="text-red-100">{rejectManyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} {rejectManyMutation.isPending ? "Rejeitando…" : "Rejeitar selecionados"}</Button></div>}</div>}
      {queueQuery.isError ? <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">Não foi possível carregar a fila. <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => void queueQuery.refetch()}>Tentar novamente</Button></div> : queueQuery.data?.items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="manual-review-list">{queueQuery.data.items.map(event => <article key={event.id} className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-[96px_1fr]"><div>{event.imageUrl ? <img src={event.imageUrl} alt={`Imagem de ${event.title}`} loading="lazy" className="h-24 w-full rounded-xl border border-white/10 object-cover" /> : <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/10 text-center text-[11px] text-zinc-600">Sem imagem</div>}</div><div className="min-w-0"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-start gap-2">{event.status === "pending" && <input type="checkbox" checked={selectedIds.includes(event.id)} onChange={() => toggleSelected(event.id)} disabled={bulkPending} aria-label={`Selecionar ${event.title}`} className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-400" />}<div className="min-w-0"><h3 className="truncate font-black text-zinc-100">{event.title}</h3><p className="mt-1 text-xs text-zinc-500">{sourceLabel(event.sourceType)} · {formatDate(event.eventDate)}</p></div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${statusClass(event.status)}`}>{statusLabel(event.status)}</span></div><p className="mt-2 text-xs text-amber-100">Motivo: {event.reason}</p><p className="mt-2 line-clamp-2 text-xs text-zinc-400">{event.summary || event.rawText || "Sem texto complementar registrado."}</p><Button type="button" variant="outline" size="sm" data-testid={`manual-review-edit-${event.id}`} className="mt-3" onClick={() => selectEvent(event)}><Edit3 size={13} /> {event.status === "pending" ? "Completar e revisar" : "Ver detalhes"}</Button></div></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">Nenhum evento encontrado para os filtros atuais.</div>}
      {(queueQuery.data?.hasNextPage || page > 0) && <div className="mt-5 flex items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0 || queueQuery.isFetching}>Anterior</Button><span className="text-xs text-zinc-500">Página {page + 1}</span><Button type="button" variant="outline" size="sm" onClick={() => setPage(current => current + 1)} disabled={!queueQuery.data?.hasNextPage || queueQuery.isFetching}>Próxima</Button></div>}

      <Dialog open={selectedEvent !== null} onOpenChange={open => { if (!open && !isSaving) { setSelectedEvent(null); setDraft(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-zinc-950 text-zinc-100">
          <DialogHeader><DialogTitle>Revisão assistida do evento</DialogTitle><DialogDescription className="text-zinc-400">Complete os campos faltantes, salve a revisão e publique somente quando os dados essenciais estiverem conferidos.</DialogDescription></DialogHeader>
          {selectedEvent && draft && <div className="grid gap-4 py-3"><section data-testid="manual-review-source-preview" aria-labelledby="manual-review-source-title" className="grid gap-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"><div className="min-w-0">{draft.imageUrl ? <img src={draft.imageUrl} alt={`Imagem original de ${draft.title}`} className="h-48 w-full rounded-xl border border-white/10 object-cover" /> : <div className="grid h-48 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600">Sem imagem original</div>}</div><div className="min-w-0"><div className="flex items-center justify-between gap-3"><h3 id="manual-review-source-title" className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100">Texto original da publicação</h3><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-zinc-500">OCR / legenda</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-zinc-500">Horários, datas e dias reconhecidos ficam destacados.</span><Button type="button" variant="outline" size="sm" onClick={() => void copyRawText()} disabled={!draft.rawText} aria-label="Copiar texto original"><Copy size={14} /> {copyState === "copied" ? "Texto copiado" : "Copiar texto original"}</Button></div><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-zinc-950/60 p-3 text-sm leading-6 text-zinc-200">{draft.rawText ? highlightRawText(draft.rawText, { onTokenClick: copyToken, onApplyToken: applyTokenToDraft, copiedToken, appliedToken }) : "Sem texto bruto registrado para esta entrada."}</pre><p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-500">{copyState === "error" ? "A cópia automática falhou; selecione o texto manualmente." : "Use esta referência para completar horário, cidade, categoria e demais campos estruturados abaixo."}</p></div></section><div className="grid gap-4 lg:grid-cols-[180px_1fr]">{draft.imageUrl ? <img src={draft.imageUrl} alt={`Imagem original de ${draft.title}`} className="h-44 w-full rounded-2xl border border-white/10 object-cover" /> : <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-600">Sem imagem original</div>}<div className="grid gap-3"><label className="grid gap-1 text-xs font-bold text-zinc-400">Título<input value={draft.title} onChange={event => setDraftField("title", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Motivo da revisão<input value={draft.reason} onChange={event => setDraftField("reason", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-zinc-400">Data e hora<input type="datetime-local" value={draft.eventDate} onChange={event => setDraftField("eventDate", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Fim (opcional)<input type="datetime-local" value={draft.endDate} onChange={event => setDraftField("endDate", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Local<input value={draft.locationName} onChange={event => setDraftField("locationName", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Cidade<select value={draft.city} onChange={event => setDraftField("city", event.target.value as ManualReviewDraft["city"])} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100"><option value="">Selecionar cidade</option><option value="Santos">Santos</option><option value="Guarujá">Guarujá</option></select></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Categoria<select value={draft.category} onChange={event => setDraftField("category", event.target.value as ManualReviewDraft["category"])} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100"><option value="">Selecionar categoria</option><option value="show">Show</option><option value="balada">Balada</option><option value="evento_musical">Evento musical</option></select></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Gênero<input value={draft.genre} onChange={event => setDraftField("genre", event.target.value)} placeholder="funk, house/eletrônica..." className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label></div><label className="grid gap-1 text-xs font-bold text-zinc-400">Endereço<input value={draft.address} onChange={event => setDraftField("address", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Resumo<textarea value={draft.summary} onChange={event => setDraftField("summary", event.target.value)} className="min-h-24 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100" /></label></div>}
          <DialogFooter className="gap-2 sm:justify-between"><div className="flex flex-wrap gap-2">{selectedEvent?.status === "pending" && <Button type="button" variant="outline" onClick={rejectSelected} disabled={isSaving} className="text-red-100"><XCircle size={14} /> Rejeitar</Button>}{selectedEvent?.status === "pending" && <Button type="button" onClick={approveSelected} disabled={isSaving} className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200"><CheckCircle2 size={14} /> {approveMutation.isPending ? "Publicando…" : "Aprovar e publicar"}</Button>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { if (!isSaving) { setSelectedEvent(null); setDraft(null); } }} disabled={isSaving}>Fechar</Button>{selectedEvent?.status === "pending" && <Button type="button" onClick={saveDraft} disabled={isSaving || !draft?.title.trim()}>{updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />} Salvar revisão</Button>}</div></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
```

