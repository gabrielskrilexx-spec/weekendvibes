import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyHealthTransition, notifyWeeklyExecutiveReport } from "./alert-webhook";

describe("alert webhook", () => {
  afterEach(() => {
    delete process.env.ALERT_WEBHOOK_URL;
    vi.restoreAllMocks();
  });

  it("envia transição de saúde sem incluir segredos", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.test/health";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await notifyHealthTransition({ previousStatus: "healthy", nextStatus: "critical", reason: "2 fontes OPEN", observedAt: "2026-10-16T20:00:00.000Z" }, fetchMock);
    expect(result).toMatchObject({ delivered: true, status: 204 });
    expect(fetchMock).toHaveBeenCalledWith("https://hooks.example.test/health", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ event: "system_health_transition", previous_status: "healthy", system_health_status: "critical" });
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("não tenta rede quando o webhook não está configurado", async () => {
    const fetchMock = vi.fn();
    await expect(notifyHealthTransition({ previousStatus: null, nextStatus: "healthy", reason: "initial", observedAt: "2026-10-16T20:00:00.000Z" }, fetchMock)).resolves.toMatchObject({ skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia o relatório semanal como evento separado", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.test/weekly";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await notifyWeeklyExecutiveReport({ system_health_status: "healthy", periodDays: 30 }, fetchMock);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ event: "weekly_executive_report", report: { system_health_status: "healthy", periodDays: 30 } });
  });
});
