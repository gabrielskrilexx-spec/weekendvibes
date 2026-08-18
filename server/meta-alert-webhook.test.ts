import { describe, expect, it, vi } from "vitest";
import { buildCriticalMetaAlertPayload, classifyCriticalMetaReason, sendCriticalMetaAlert } from "./meta-alert-webhook";

describe("Meta critical alert webhook contract", () => {
  it("classifies blocked credentials and severe Meta authentication codes", () => {
    expect(classifyCriticalMetaReason({ error: { code: 190, message: "Invalid OAuth access token" } })).toBe("invalid_token");
    expect(classifyCriticalMetaReason("blocked_credentials")).toBe("blocked_credentials");
    expect(classifyCriticalMetaReason("temporary upstream timeout")).toBeNull();
  });

  it("builds a redacted payload without tokens or webhook URLs", () => {
    const payload = buildCriticalMetaAlertPayload({
      reason: "blocked_credentials",
      occurredAt: new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(payload).toEqual({
      content: expect.stringContaining("blocked_credentials"),
    });
    expect(payload.content).toContain("2026-08-18T12:00:00.000Z");
    expect(payload.content).toContain("renovação manual");
    expect(payload.content).not.toMatch(/EAA|Bearer\s|https:\/\/discord/i);
  });

  it("sends only to a valid Discord webhook and redacts the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const result = await sendCriticalMetaAlert({ reason: "invalid_token", occurredAt: new Date("2026-08-18T12:00:00.000Z"), fetchImpl: fetchMock }, "https://discord.com/api/webhooks/123/secret");
    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("https://discord.com/api/webhooks/"), expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.content).toContain("renovação manual");
    expect(body.content).not.toContain("secret");
  });

  it("does not call the network when the secret is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendCriticalMetaAlert({ reason: "blocked_credentials", fetchImpl: fetchMock }, undefined)).resolves.toEqual({ sent: false, reason: "missing_webhook" });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
