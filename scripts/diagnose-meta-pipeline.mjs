import { runInstagramPipeline } from "../server/instagram-pipeline.ts";

const sanitize = (value) => String(value ?? "")
  .replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]")
  .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
  .replace(/[\r\n\t]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 320);

try {
  const result = await runInstagramPipeline({ dryRun: true });
  console.log(JSON.stringify({ ok: true, degraded: result.degraded, receivedPosts: result.receivedPosts, imported: result.imported, transportFailures: result.transportFailures }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    name: error?.name ?? "Error",
    integration: error?.integration ?? "unknown",
    status: error?.upstreamStatus ?? null,
    message: sanitize(error?.message ?? error),
    cause: error?.cause ? sanitize(error.cause?.message ?? error.cause) : null,
  }, null, 2));
  process.exitCode = 1;
}
