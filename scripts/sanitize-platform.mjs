import { runPlatformSanitization } from "../server/platform-sanitization.ts";

try {
  const result = await runPlatformSanitization(new Date());
  console.log(JSON.stringify({
    ok: true,
    cutoff: result.cutoff,
    staleAlertsResolved: result.alerts.resolvedCount,
    manualReviewExpired: result.manualReview.expiredCount,
    instagramSourcesReset: result.reset.resetCount,
    publicSourcesPaused: result.paused.pausedCount,
    pausedSourceKeys: result.paused.sourceKeys,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "sanitization_failed" }));
  process.exitCode = 1;
}
