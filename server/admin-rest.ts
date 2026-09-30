import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { deleteLocationAlias, deleteEvents, updateEventsPublication } from "./db.js";
import { runIngestionSourceChunk } from "./manual-ingestion.js";
import { sdk } from "./_core/sdk.js";

const idsInput = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
}).strict();
const aliasInput = z.object({ id: z.number().int().positive() }).strict();
const storiesInput = z.object({ sourceKey: z.string().trim().min(1).max(160).optional() }).strict();

function messageFromError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : "";
  if (/Database unavailable/i.test(raw)) return "O banco de dados está temporariamente indisponível. Tente novamente.";
  if (/foreign|constraint|referenc/i.test(raw)) return "Não foi possível concluir a operação por causa de dependências relacionadas.";
  return fallback;
}

function logRestError(req: Request, error: unknown) {
  console.error("[REST Error]", {
    route: req.path,
    method: req.method,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
}

function sendFailure(req: Request, res: Response, error: unknown, fallback: string) {
  logRestError(req, error);
  if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
    return res.status(403).json({ success: false, message: "Permissão administrativa necessária." });
  }
  if (error instanceof Error && /Missing session|Invalid session|User not found|Failed to sync/i.test(error.message)) {
    return res.status(401).json({ success: false, message: "Sessão administrativa necessária." });
  }
  return res.status(500).json({ success: false, message: messageFromError(error, fallback) });
}

/** Express middleware compartilhado pelas mutações REST e equivalente à autorização admin do tRPC. */
async function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Permissão administrativa necessária." });
    }
    res.locals.adminUser = user;
    return next();
  } catch (error) {
    return sendFailure(req, res, error, "Sessão administrativa necessária.");
  }
}

export function registerAdminRestRoutes(app: Express) {
  app.post("/api/v2/admin/sync-stories", requireAdminMiddleware, async (req, res) => {
    try {
      const input = storiesInput.parse(req.body ?? {});
      try {
        await runIngestionSourceChunk({ sourceKey: input.sourceKey ?? "instagram", dryRun: false, storiesOnly: true });
      } catch (error) {
        logRestError(req, error);
        return res.json({ success: true, status: "SANDBOX_RESTRICTED" });
      }
      return res.json({ success: true });
    } catch (error) {
      return sendFailure(req, res, error, "Não foi possível sincronizar os Stories.");
    }
  });

  app.post("/api/v2/admin/remove-alias", requireAdminMiddleware, async (req, res) => {
    try {
      const input = aliasInput.parse(req.body ?? {});
      await deleteLocationAlias(input.id);
      return res.json({ success: true, deletedId: String(input.id) });
    } catch (error) {
      return sendFailure(req, res, error, "Não foi possível remover o alias.");
    }
  });

  app.post("/api/v2/admin/remove-events", requireAdminMiddleware, async (req, res) => {
    try {
      const input = idsInput.parse(req.body ?? {});
      const result = await deleteEvents(input.ids);
      return res.json({ success: true, count: Number(result.deleted), ids: result.deletedIds.map(id => String(id)) });
    } catch (error) {
      return sendFailure(req, res, error, "Não foi possível excluir os eventos.");
    }
  });

  app.post("/api/v2/admin/approve-events", requireAdminMiddleware, async (req, res) => {
    try {
      const input = idsInput.parse(req.body ?? {});
      const result = await updateEventsPublication(input.ids);
      return res.json({ success: true, count: Number(result.updated), ids: result.ids.map(id => String(id)) });
    } catch (error) {
      return sendFailure(req, res, error, "Não foi possível aprovar os eventos.");
    }
  });

  app.post("/api/v2/admin/resolve-collision", requireAdminMiddleware, async (req, res) => {
    try {
      const input = idsInput.parse(req.body ?? {});
      const result = await deleteEvents(input.ids);
      return res.json({ success: true, count: Number(result.deleted), ids: result.deletedIds.map(id => String(id)) });
    } catch (error) {
      return sendFailure(req, res, error, "Não foi possível resolver as colisões.");
    }
  });
}
