const endpointBase = process.env.SCHEDULED_TASK_ENDPOINT_BASE?.trim().replace(/\/$/, "");
const cronSecret = process.env.INTERNAL_CRON_SECRET?.trim();
const scheduledTaskCookie = process.env.SCHEDULED_TASK_COOKIE?.trim();

function sanitizeBody(raw: string) {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      ok: value.ok === true,
      accepted: value.accepted === true,
      status: typeof value.status === "string" ? value.status : undefined,
      runId: typeof value.runId === "string" ? value.runId : undefined,
      actorRunId: typeof value.actorRunId === "string" ? value.actorRunId : undefined,
      error: typeof value.error === "string" ? value.error.slice(0, 240) : undefined,
      message: typeof value.message === "string" ? value.message.slice(0, 240) : undefined,
    };
  } catch {
    return { ok: false, error: "non_json_response" };
  }
}

if (!endpointBase || !cronSecret) {
  console.log(JSON.stringify({
    ok: false,
    error: "missing_required_runtime_secret",
    hasEndpointBase: Boolean(endpointBase),
    hasCronSecret: Boolean(cronSecret),
  }));
  process.exit(2);
}

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  "x-cron-secret": cronSecret,
};
if (scheduledTaskCookie) headers.Cookie = `app_session_id=${scheduledTaskCookie}`;

const startedAt = performance.now();
try {
  const response = await fetch(`${endpointBase}/api/v2/ingestion/instagram/async`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const result = sanitizeBody(await response.text());
  console.log(JSON.stringify({ httpStatus: response.status, durationMs, ...result }));
  process.exit(response.ok ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify({
    httpStatus: null,
    durationMs: Math.round(performance.now() - startedAt),
    error: error instanceof Error ? error.message.slice(0, 240) : "request_failed",
  }));
  process.exit(1);
}
