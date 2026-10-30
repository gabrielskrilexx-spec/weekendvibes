import { runWednesdayRoutineNow } from "../server/manual-ingestion";

const args = process.argv.slice(2);
const unsupportedArgs = args.filter(argument => argument !== "--force-apify-all");
if (unsupportedArgs.length > 0) {
  console.error(JSON.stringify({ status: "invalid_arguments", supported: ["--force-apify-all"] }));
  process.exitCode = 2;
} else {
  const forceApifyAll = args.includes("--force-apify-all");
  try {
    const result = await runWednesdayRoutineNow({ forceApifyAll });
    const summary = result.automationSummary && typeof result.automationSummary === "object"
      ? result.automationSummary as { sources?: unknown; errors?: unknown }
      : {};
    const sources = Array.isArray(summary.sources)
      ? summary.sources.filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === "object")
      : [];
    const summarize = (prefix: "public" | "instagram") => {
      const matching = sources.filter(source => {
        const key = String(source.sourceKey ?? "");
        return key === prefix || key.startsWith(`${prefix}:`);
      });
      const sum = (key: string) => matching.reduce((total, source) => total + (Number.isFinite(Number(source[key])) ? Number(source[key]) : 0), 0);
      const failedSources = matching.filter(source => Array.isArray(source.errors) && source.errors.length > 0).length;
      return { sourceCount: matching.length, read: sum("read"), added: sum("added"), updated: sum("updated"), ignored: sum("ignored"), failedSources };
    };
    console.log(JSON.stringify({
      status: result.status ?? "unknown",
      forceApifyAll,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      public: summarize("public"),
      instagram: summarize("instagram"),
      errorCount: Array.isArray(summary.errors) ? summary.errors.length : 0,
    }, null, 2));
  } catch {
    console.error(JSON.stringify({ status: "failed", message: "A execução falhou; consulte os registros sanitizados no banco." }));
    process.exitCode = 1;
  }
}
