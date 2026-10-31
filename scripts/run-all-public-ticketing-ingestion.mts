import { and, eq } from "drizzle-orm";
import { ingestionSources } from "../drizzle/schema";
import { getDb } from "../server/db";
import { runPublicAgendaStep } from "../server/agenda-routine";
import { sanitizePublicSourceUrl } from "../server/ingestion";
import { getTicketingPlatform, ticketingPlatformLabel } from "../server/ticketing-catalog-audit";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");

  const sources = await db.select({
    sourceKey: ingestionSources.sourceKey,
    url: ingestionSources.url,
  }).from(ingestionSources).where(and(eq(ingestionSources.kind, "public"), eq(ingestionSources.isEnabled, 1)));

  const uniqueUrls = Array.from(new Set(sources.map(source => sanitizePublicSourceUrl(source.url)).filter(Boolean)));
  if (uniqueUrls.length === 0) throw new Error("no_active_public_sources");

  const platformCounts = new Map<string, number>();
  for (const url of uniqueUrls) {
    const platform = ticketingPlatformLabel(getTicketingPlatform(url));
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
  }

  const run = await runPublicAgendaStep({
    track: true,
    sourceKey: "public",
    sourceUrls: uniqueUrls,
    archive: false,
    trigger: "manual",
  });
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
  console.error(JSON.stringify({ ok: false, error: name, ...(code ? { code } : {}) }));
  process.exitCode = 1;
});
