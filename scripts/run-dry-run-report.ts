import { runDryRun } from "../server/dry-run";

const report = await runDryRun();
console.log(JSON.stringify({
  dryRun: report.dryRun,
  startedAt: report.startedAt,
  finishedAt: report.finishedAt,
  durationMs: report.durationMs,
  totals: report.totals,
  sources: report.sources.map(source => ({
    routine: source.routine,
    sourceKey: source.sourceKey,
    durationMs: source.durationMs,
    read: source.read,
    filtered: source.filtered,
    persistable: source.persistable,
    duplicates: source.duplicates,
    rejectionReasons: source.rejectionReasons,
    errors: source.errors,
  })),
}, null, 2));
