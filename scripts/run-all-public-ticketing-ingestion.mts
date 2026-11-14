import { and, eq } from "drizzle-orm";
import { ingestionSources } from "../drizzle/schema";
import { getDb } from "../server/db";
import { runPublicAgendaStep } from "../server/agenda-routine";
import { getConfiguredSourceUrls, runIngestionPipeline, sanitizePublicSourceUrl } from "../server/ingestion";
import { getTicketingPlatform, ticketingPlatformLabel } from "../server/ticketing-catalog-audit";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = await getDb();
  if (!db && !dryRun) throw new Error("database_unavailable");

  let sources: Array<{ sourceKey: string; url: string }> = [];
  if (db) {
    try {
      sources = await db.select({
        sourceKey: ingestionSources.sourceKey,
        url: ingestionSources.url,
      }).from(ingestionSources).where(and(eq(ingestionSources.kind, "public"), eq(ingestionSources.isEnabled, 1)));
    } catch (error) {
      if (!dryRun) throw error;
      console.warn("[Ticketing dry-run] source catalog unavailable; using configured URLs", error instanceof Error ? error.message.slice(0, 180) : "unknown_error");
    }
  }

  const configuredUrls = dryRun && sources.length === 0 ? getConfiguredSourceUrls() : sources.map(source => source.url);
  const uniqueUrls = Array.from(new Set(configuredUrls.map(sanitizePublicSourceUrl).filter(Boolean)));
  if (uniqueUrls.length === 0) throw new Error("no_active_public_sources");

  const platformCounts = new Map<string, number>();
  for (const url of uniqueUrls) {
    const platform = ticketingPlatformLabel(getTicketingPlatform(url));
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
  }

  const run = dryRun
    ? { archived: 0, result: await runIngestionPipeline({ dryRun: true, sourceKey: "public", sourceUrls: uniqueUrls }) }
    : await runPublicAgendaStep({ track: true, sourceKey: "public", sourceUrls: uniqueUrls, archive: false, trigger: "manual" });
  const result = run.result;
  const sourceReports = Array.isArray(result.sourceReports) ? result.sourceReports.map(source => ({
    sourceKey: source.sourceKey,
    read: source.read,
    added: source.added,
    updated: source.updated,
    ignored: source.ignored,
    errors: source.errors.length,
  })) : [];

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    routine: "public-agenda",
    scope: "all-active-public-ticketing-sources",
    sourceCount: sources.length,
    uniqueUrlCount: uniqueUrls.length,
    sourcesByPlatform: Array.from(platformCounts.entries()).map(([platform, count]) => ({ platform, count })).sort((a, b) => a.platform.localeCompare(b.platform, "pt-BR")),
    archived: run.archived,
    imported: result.imported ?? 0,
    persisted: result.persisted ?? 0,
    added: result.added ?? 0,
    updated: result.updated ?? 0,
    ignored: result.ignored ?? 0,
    read: result.read ?? 0,
    filtered: result.filtered ?? 0,
    duplicates: result.duplicates ?? 0,
    discovered: result.discovered ?? 0,
    matchedSources: result.matchedSources ?? 0,
    fetchFailures: Array.isArray(result.fetchFailures) ? result.fetchFailures.length : 0,
    sourceReports,
  }, null, 2));
}

main().catch(error => {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name ?? "Error") : "Error";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/gi, "fonte pública").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 240) : String(error).slice(0, 240);
  console.error(JSON.stringify({ ok: false, error: name, message, ...(code ? { code } : {}) }));
  process.exitCode = 1;
});
