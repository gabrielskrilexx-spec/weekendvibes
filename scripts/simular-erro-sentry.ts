import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();
if (!dsn) {
  console.error("SENTRY_DSN=missing; nenhum evento foi enviado");
  process.exit(1);
}

const testRunId = 99000001;
const testActorRunId = "sentry-simulation-actor-run";

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV ?? "development",
  release: "weekendvibes-sentry-simulation",
  tracesSampleRate: 0,
});

function captureSimulation(error: Error, context: { operation: string; stage: string }) {
  Sentry.captureException(error, {
    tags: {
      operation: "instagram-ingestion",
      simulation: "true",
      simulation_type: context.operation,
      stage: context.stage,
    },
    extra: {
      runId: testRunId,
      actorRunId: testActorRunId,
      source: "scripts/simular-erro-sentry.ts",
      realDatabaseTouched: false,
      realApifyActorStarted: false,
    },
  });
}

async function main() {
  const timeoutError = new Error("Apify Actor start timeout after 8000ms");
  timeoutError.name = "ApifyNetworkTimeoutError";
  captureSimulation(timeoutError, {
    operation: "apify_actor_start",
    stage: "dispatch",
  });

  const datasetError = new Error("Dataset item schema validation failed: missing mediaUrl");
  datasetError.name = "DatasetValidationError";
  captureSimulation(datasetError, {
    operation: "instagram_dataset_processing",
    stage: "normalize_item",
  });

  const flushed = await Sentry.flush(10_000);
  if (!flushed) {
    throw new Error("Sentry flush did not complete within the timeout");
  }

  console.log(JSON.stringify({
    sent: true,
    events: 2,
    operations: ["apify_actor_start", "instagram_dataset_processing"],
    runId: testRunId,
    databaseTouched: false,
    actorStarted: false,
  }));
}

main().catch(error => {
  console.error(JSON.stringify({
    sent: false,
    error: error instanceof Error ? error.message : "simulation_failed",
  }));
  process.exitCode = 1;
});
