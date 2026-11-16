import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAdminUser } from "./_core/admin-auth";
import { sdk } from "./_core/sdk";
import {
  isAllowedPushEndpoint,
  PushServiceConfigurationError,
  removePushSubscription,
  savePushSubscription,
  sendPushNotification,
} from "./push-notifications";

const endpointInput = z.string().trim().url().max(2048).refine(isAllowedPushEndpoint);
const subscriptionInput = z.object({
  endpoint: endpointInput,
  keys: z.object({
    p256dh: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
    auth: z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),
  }).strict(),
}).strict();
const removeInput = z.object({ endpoint: endpointInput }).strict();
const notificationInput = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().min(1).max(512).refine(value => value.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f]/.test(value)),
  tag: z.string().trim().min(1).max(100).optional(),
}).strict();

function noStore(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function pushFailure(res: Response, error: unknown) {
  if (error instanceof PushServiceConfigurationError) {
    return res.status(503).json({ success: false, message: "O envio de notificações push ainda não está configurado." });
  }
  if (error instanceof Error && error.message === "database_unavailable") {
    return res.status(503).json({ success: false, message: "O serviço de notificações está temporariamente indisponível." });
  }
  return res.status(503).json({ success: false, message: "Não foi possível concluir a operação de notificações." });
}

async function requireAdmin(req: Request, res: Response) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ success: false, message: "Sessão administrativa necessária." });
    return false;
  }
  if (!isAdminUser(user)) {
    res.status(403).json({ success: false, message: "Permissão administrativa necessária." });
    return false;
  }
  return true;
}

export function registerPushRestRoutes(app: Express) {
  app.post("/api/push/subscriptions", async (req, res) => {
    noStore(res);
    const parsed = subscriptionInput.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Assinatura push inválida." });
    try {
      await savePushSubscription(parsed.data);
      return res.status(200).json({ success: true });
    } catch (error) {
      return pushFailure(res, error);
    }
  });

  app.delete("/api/push/subscriptions", async (req, res) => {
    noStore(res);
    const parsed = removeInput.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Assinatura push inválida." });
    try {
      await removePushSubscription(parsed.data.endpoint);
      return res.status(200).json({ success: true });
    } catch (error) {
      return pushFailure(res, error);
    }
  });

  app.post("/api/v2/admin/push/send", async (req, res) => {
    noStore(res);
    if (!await requireAdmin(req, res)) return;
    const parsed = notificationInput.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: "Conteúdo de notificação inválido." });
    try {
      const result = await sendPushNotification({ ...parsed.data, url: parsed.data.url });
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return pushFailure(res, error);
    }
  });
}
