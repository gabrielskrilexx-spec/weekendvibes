import { runIngestionSourceChunk } from "../server/manual-ingestion.ts";

const sanitize = (value) => String(value ?? "")
  .replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]")
  .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
  .replace(/[\r\n\t]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 240);

try {
  const execution = await runIngestionSourceChunk({ sourceKey: "instagram", dryRun: false });
  const raw = execution?.result && typeof execution.result === "object" ? execution.result : execution;
  const value = raw && typeof raw === "object" ? raw : {};
  const failures = Array.isArray(value.transportFailures)
    ? value.transportFailures.slice(0, 12).map((failure) => ({
        status: Number(failure?.status ?? 0),
        kind: String(failure?.kind ?? "unknown"),
        username: String(failure?.username ?? "").slice(0, 80),
        message: sanitize(failure?.message),
      }))
    : [];
  console.log(JSON.stringify({
    ok: true,
    sourceKey: "instagram",
    status: value.degraded === true || failures.length > 0 ? "partial" : "succeeded",
    degraded: value.degraded === true,
    receivedPosts: Number(value.receivedPosts ?? 0),
    approvedPosts: Number(value.approvedPosts ?? 0),
    imported: Number(value.imported ?? value.persisted ?? 0),
    transportFailures: failures,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    sourceKey: "instagram",
    name: error?.name ?? "Error",
    integration: error?.integration ?? "unknown",
    upstreamStatus: error?.upstreamStatus ?? null,
    message: sanitize(error?.message ?? error),
  }, null, 2));
  process.exitCode = 1;
}
