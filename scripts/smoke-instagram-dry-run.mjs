import { runIngestionSourceChunk } from "../server/manual-ingestion.ts";

const result = await runIngestionSourceChunk({ sourceKey: "instagram", dryRun: true, storiesOnly: true });
const pipeline = result.result ?? {};
console.log(JSON.stringify({
  sourceKey: result.sourceKey,
  dryRun: result.dryRun,
  previewMock: pipeline.previewMock === true,
  receivedPosts: Number(pipeline.receivedPosts ?? 0),
  approvedPosts: Number(pipeline.approvedPosts ?? 0),
  structuredEvents: Number(pipeline.structuredEvents ?? 0),
  persisted: Number(pipeline.persisted ?? 0),
  filtered: Number(pipeline.filtered ?? 0),
  degraded: pipeline.degraded === true,
  transportFailures: Array.isArray(pipeline.transportFailures) ? pipeline.transportFailures.length : 0,
  error: pipeline.error ?? null,
}));
if (!result || result.dryRun !== true) process.exit(2);
