import { afterEach, describe, expect, it, vi } from "vitest";

describe("ingestion preview mock settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("habilita mocks por padrão fora de produção", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const settings = await import("./ingestion-preview-settings");
    expect(settings.getSandboxMockSettings()).toEqual({ allowSandboxMocks: true, environment: "preview" });
    expect(settings.shouldUseSandboxMocks()).toBe(true);
  });

  it("desabilita mocks em produção mesmo que o toggle seja solicitado", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const settings = await import("./ingestion-preview-settings");
    expect(settings.getSandboxMockSettings()).toEqual({ allowSandboxMocks: false, environment: "production" });
    expect(settings.setSandboxMocksAllowed(true)).toEqual({ allowSandboxMocks: false, environment: "production" });
    expect(settings.shouldUseSandboxMocks()).toBe(false);
  });
});


describe("sandbox network classification", () => {
  it("classifica falhas nativas de conexão em desenvolvimento", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { isSandboxRestrictedError } = await import("./external-fetch");
    expect(isSandboxRestrictedError(new Error("fetch failed: ECONNREFUSED"))).toBe(true);
    expect(isSandboxRestrictedError(new Error("ENOTFOUND upstream"))).toBe(true);
  });

  it("não classifica falha de conexão como sandbox em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { isSandboxRestrictedError } = await import("./external-fetch");
    expect(isSandboxRestrictedError(new Error("fetch failed: ECONNREFUSED"))).toBe(false);
  });
});

 afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
