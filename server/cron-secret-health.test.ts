import { describe, expect, it } from "vitest";

describe("published cron secret", () => {
  it("autentica no endpoint leve de saúde sem expor o segredo", async () => {
    const endpointBase = process.env.SCHEDULED_TASK_ENDPOINT_BASE?.trim().replace(/\/$/, "");
    const secret = process.env.INTERNAL_CRON_SECRET?.trim();
    expect(endpointBase).toBeTruthy();
    expect(secret).toBeTruthy();

    const response = await fetch(`${endpointBase}/api/scheduled/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret as string },
      body: "{}",
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload).toMatchObject({ ok: true });
    expect(JSON.stringify(payload)).not.toContain(secret as string);
  });
});
