import { backfillRemoteEventCovers } from "../server/db";

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find(value => value.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 500;

async function main() {
  const result = await backfillRemoteEventCovers({
    limit: Number.isFinite(limit) ? limit : 500,
    dryRun: args.has("--dry-run"),
  });
  console.log(JSON.stringify({ ok: true, routine: "maintenance:backfill-event-covers", ...result }, null, 2));
}

main().catch(error => {
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name ?? "Error")
    : "Error";
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  console.error(JSON.stringify({ ok: false, error: name, ...(code ? { code } : {}) }));
  process.exitCode = 1;
});
