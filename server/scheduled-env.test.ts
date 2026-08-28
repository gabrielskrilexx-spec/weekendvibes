import { describe, expect, it } from "vitest";

describe("scheduled runtime environment", () => {
  it("uses the configured endpoint base and cookie for a lightweight authenticated request", async () => {
    const endpointBase = process.env.SCHEDULED_TASK_ENDPOINT_BASE;
    const cookie = process.env.SCHEDULED_TASK_COOKIE;
    expect(endpointBase).toBeTruthy();
    expect(cookie).toBeTruthy();

    const response = await fetch(`${endpointBase}/api/trpc/auth.me`, {
      headers: {
        Accept: "application/json",
        Cookie: `app_session_id=${encodeURIComponent(cookie ?? "")}`,
      },
    });

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: unknown; error?: unknown };
    expect(payload.error).toBeUndefined();
    expect(payload.result).toBeDefined();
  }, 15_000);

  it("accepts the configured machine secret on the lightweight cron health callback", async () => {
    const endpointBase = process.env.SCHEDULED_TASK_TEST_ENDPOINT_BASE ?? "http://127.0.0.1:3000";
    const cronSecret = process.env.INTERNAL_CRON_SECRET;
    expect(process.env.SCHEDULED_TASK_ENDPOINT_BASE).toBeTruthy();
    expect(cronSecret).toBeTruthy();

    const response = await fetch(`${endpointBase}/api/scheduled/health`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "x-cron-secret": cronSecret ?? "",
      },
    });

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.status).toBe(200);
    const payload = await response.json() as { ok?: unknown; error?: unknown };
    expect(payload.error).toBeUndefined();
    expect(payload.ok).toBe(true);
  }, 15_000);
});

// This smoke test intentionally uses only the public auth query and never prints the cookie.
