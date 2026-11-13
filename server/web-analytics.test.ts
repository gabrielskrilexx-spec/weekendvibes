import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { webAnalyticsHandler } from "./web-analytics";

function fakeResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  return response as unknown as Response & typeof response;
}

describe("web analytics endpoint", () => {
  it("aceita apenas evento e rota agregados e não registra identificadores pessoais", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = fakeResponse();
    webAnalyticsHandler({ body: { event: "page_view", path: "/eventos/festa-teste", email: "private@example.test", query: "secret" } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    const logged = String(log.mock.calls[0]?.[1]);
    expect(logged).toContain("page_view");
    expect(logged).toContain("/eventos/festa-teste");
    expect(logged).not.toContain("private@example.test");
    expect(logged).not.toContain("secret");
    log.mockRestore();
  });

  it("rejeita eventos ou caminhos fora da allowlist", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = fakeResponse();
    webAnalyticsHandler({ body: { event: "unknown", path: "/agenda?token=secret" } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "INVALID_ANALYTICS_EVENT" });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
