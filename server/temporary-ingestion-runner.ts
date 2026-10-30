import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { queueWednesdayRoutineNow } from "./manual-ingestion";

const TOKEN_ENV_KEY = "WV_TEMPORARY_INGESTION_RUNNER_TOKEN_20261030";
const RUNNER_MARKER_KEY = "temporary_ingestion_runner_used_20261030";

function constantTimeMatch(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export function authenticateTemporaryIngestionRunner(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env[TOKEN_ENV_KEY]?.trim();
  if (!expectedToken) return res.status(404).json({ error: "not_found" });

  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!constantTimeMatch(expectedToken, suppliedToken)) return res.status(401).json({ error: "unauthorized" });
  return next();
}

function hasUnexpectedRequestBody(req: Request) {
  if (req.headers["transfer-encoding"] !== undefined) return true;
  const rawContentLength = req.headers["content-length"];
  if (rawContentLength !== undefined) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength !== 0) return true;
  }
  const body = req.body;
  if (body === undefined || body === null || body === "") return false;
  if (typeof body !== "object" || Array.isArray(body)) return true;
  return Object.keys(body).length > 0;
}

export async function temporaryIngestionRunnerHandler(req: Request, res: Response) {
  if (hasUnexpectedRequestBody(req)) return res.status(400).json({ error: "empty_body_required" });

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch {
    return res.status(503).json({ error: "database_unavailable" });
  }
  if (!db) return res.status(503).json({ error: "database_unavailable" });

  let markerClaimed = false;
  try {
    const claim = await db.insert(appSettings)
      .values({ key: RUNNER_MARKER_KEY, value: `claimed:${new Date().toISOString()}` })
      .onConflictDoNothing()
      .returning({ key: appSettings.key });
    if (claim.length === 0) return res.status(409).json({ error: "runner_already_used" });
    markerClaimed = true;

    const accepted = await queueWednesdayRoutineNow({ forceApifyAll: true });
    try {
      await db.update(appSettings)
        .set({ value: `accepted:${accepted.runId}`, updatedAt: new Date() })
        .where(eq(appSettings.key, RUNNER_MARKER_KEY));
    } catch {
      // The one-time claim remains persisted even if its optional audit detail cannot be updated.
    }
    return res.status(202).json({ accepted: true, runId: accepted.runId, startedAt: accepted.startedAt });
  } catch {
    if (markerClaimed) {
      try {
        await db.delete(appSettings).where(eq(appSettings.key, RUNNER_MARKER_KEY));
      } catch {
        // A persisted claim is safer than risking a second production ingestion attempt.
      }
    }
    return res.status(503).json({ error: "runner_unavailable" });
  }
}
