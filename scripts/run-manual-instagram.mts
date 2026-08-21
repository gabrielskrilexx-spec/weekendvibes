import { runInstagramAgendaStep } from "../server/agenda-routine";

function sanitize(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const result = input.result && typeof input.result === "object" ? input.result as Record<string, unknown> : input;
  const pipeline = result.result && typeof result.result === "object" ? result.result as Record<string, unknown> : result;
  return {
    archived: Number(result.archived ?? 0),
    geocoding: result.geocoding,
    imported: Number(pipeline.imported ?? 0),
    read: Number(pipeline.read ?? pipeline.receivedPosts ?? 0),
    filtered: Number(pipeline.filtered ?? 0),
    persisted: Number(pipeline.persisted ?? pipeline.imported ?? 0),
    duplicates: Number(pipeline.duplicates ?? 0),
    degraded: pipeline.degraded === true,
  };
}

try {
  const output = await runInstagramAgendaStep();
  console.log(JSON.stringify({ ok: true, routine: "instagram-agenda", result: sanitize(output) }));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    routine: "instagram-agenda",
    error: error instanceof Error ? error.message.slice(0, 240) : "Falha sanitizada na execução",
  }));
  process.exitCode = 1;
}
