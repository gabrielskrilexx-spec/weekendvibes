import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { ingestAgentDocuments, type AgentEventDocument } from "./agent-ingestion";
import { archiveExpiredSoldOutEvents } from "./db";
import { HttpError } from "@shared/_core/errors";

export async function ingestAgentDocumentsHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 403) return res.status(403).json({ error: "cron-only" });
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, startedAt, finishedAt: new Date().toISOString() });
  }
  if (!user.isCron) return res.status(403).json({ error: "cron-only" });
  try {
    const documents = Array.isArray(req.body?.documents) ? req.body.documents : [];
    if (documents.length > 30) return res.status(413).json({ error: "too-many-documents" });
    const normalized = documents.filter((document: unknown): document is AgentEventDocument => {
      if (!document || typeof document !== "object") return false;
      const candidate = document as Partial<AgentEventDocument>;
      return typeof candidate.sourceUrl === "string" && /^https:\/\/(www\.)?(articket\.com\.br|blacktag\.com\.br|zig\.tickets|ingresse\.com)\//.test(candidate.sourceUrl) && typeof candidate.text === "string" && candidate.sourceUrl.length <= 500 && candidate.text.length <= 16000;
    });
    const archived = await archiveExpiredSoldOutEvents();
    const result = await ingestAgentDocuments(normalized);
    return res.json({ ok: true, startedAt, finishedAt: new Date().toISOString(), archived, result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, startedAt, finishedAt: new Date().toISOString() });
  }
}
